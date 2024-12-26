const readline = require("readline");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { SocksProxyAgent } = require("socks-proxy-agent");
const fs = require("fs").promises;
const path = require("path");
const config = require("./config");
const { generateRandomHardwareInfo } = require("./common");

const apiBaseUrl = "https://gateway-run.bls.dev/api/v1";
let connectionOption;
const MAX_PING_ERRORS = 3;
const pingInterval = 120000;
const restartDelay = 240000;
const processRestartDelay = 150000;
const retryDelay = 150000;
const hardwareInfoFile = path.join(__dirname, "hardwareInfo.json");

async function loadFetch() {
  const fetch = await import("node-fetch").then((module) => module.default);
  return fetch;
}

function getFormattedTime() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `[${hours}:${minutes}:${seconds}]`;
}

async function promptConnectionOption() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      `连接选项:\n1. 使用代理\n2. 不使用代理\n请选择选项 (1/2): `,
      (answer) => {
        rl.close();
        resolve(parseInt(answer, 10));
      }
    );
  });
}

const commonHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.5",
};

async function fetchIpAddress(fetch, agent = null) {
  const primaryUrl = "https://ip-check.bless.network/";
  const fallbackUrl = "https://api.ipify.org?format=json";

  try {
    const response = await fetch(primaryUrl, { agent, headers: commonHeaders });
    const data = await response.json();
    console.log(`[${getFormattedTime()}] 从主要URL获取IP响应:`, data);
    return data.ip;
  } catch (error) {
    console.error(
      `[${getFormattedTime()}] 使用headers从主要URL获取IP地址失败: ${
        error.message
      }`
    );
  }

  try {
    const response = await fetch(fallbackUrl, {
      agent,
      headers: commonHeaders,
    });
    const data = await response.json();
    console.log(`[${getFormattedTime()}] 从备用URL获取IP响应:`, data);
    return data.ip;
  } catch (fallbackError) {
    console.error(
      `[${getFormattedTime()}] 使用headers从备用URL获取IP地址失败: ${
        fallbackError.message
      }`
    );
  }

  console.log(`[${getFormattedTime()}] 不使用headers重试中...`);

  try {
    const response = await fetch(primaryUrl, { agent });
    const data = await response.json();
    console.log(
      `[${getFormattedTime()}] 不使用headers从主要URL获取IP响应:`,
      data
    );
    return data.ip;
  } catch (error) {
    console.error(
      `[${getFormattedTime()}] 不使用headers从主要URL获取IP地址失败: ${
        error.message
      }`
    );
  }

  try {
    const response = await fetch(fallbackUrl, { agent });
    const data = await response.json();
    console.log(
      `[${getFormattedTime()}] 不使用headers从备用URL获取IP响应:`,
      data
    );
    return data.ip;
  } catch (fallbackError) {
    console.error(
      `[${getFormattedTime()}] 不使用headers从备用URL获取IP地址失败: ${
        fallbackError.message
      }`
    );
    return null;
  }
}

async function loadHardwareInfo() {
  try {
    const data = await fs.readFile(hardwareInfoFile, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

async function saveHardwareInfo(hardwareInfo) {
  await fs.writeFile(hardwareInfoFile, JSON.stringify(hardwareInfo, null, 2));
}

const handleErr = async (response) => {
  try {
    const data = await response.json();
    console.log(`[${getFormattedTime()}] 注册响应:`, data);
    return data;
  } catch (error) {
    const text = await response.text();
    console.error(`[${getFormattedTime()}] 解析JSON失败。响应文本:`, text);
    throw new Error(`无效的JSON响应: ${text}`);
  }
};

async function registerNode(nodeId, hardwareId, ipAddress, agent, authToken) {
  const fetch = await loadFetch();
  const registerUrl = `${apiBaseUrl}/nodes/${nodeId}`;
  console.log(
    `[${new Date().toISOString()}] 正在注册节点，IP: ${ipAddress}, 硬件ID: ${hardwareId}`
  );

  let hardwareInfo = await loadHardwareInfo();
  if (!hardwareInfo[nodeId]) {
    hardwareInfo[nodeId] = generateRandomHardwareInfo();
    await saveHardwareInfo(hardwareInfo);
  }

  const response = await fetch(registerUrl, {
    method: "POST",
    headers: {
      ...commonHeaders,
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      ipAddress,
      hardwareId,
      hardwareInfo: hardwareInfo[nodeId],
      extensionVersion: "0.1.7",
    }),
    agent,
  });
  await handleErr(response);
}

async function startSession(nodeId, agent, authToken) {
  const fetch = await loadFetch();
  const startSessionUrl = `${apiBaseUrl}/nodes/${nodeId}/start-session`;
  console.log(
    `[${getFormattedTime()}] Starting session for node ${nodeId}, it might take a while...`
  );
  const response = await fetch(startSessionUrl, {
    method: "POST",
    headers: {
      ...commonHeaders,
      Authorization: `Bearer ${authToken}`,
    },
    agent,
  });

  await handleErr(response);
}

async function checkNodeStatus(nodeId, fetch, agent = null) {
  const nodeStatusUrl = `${apiBaseUrl}/nodes/${nodeId}`;
  try {
    const response = await fetch(nodeStatusUrl, {
      agent,
      headers: commonHeaders,
    });
    if (response.ok) {
      console.log(`[${getFormattedTime()}] Node ${nodeId} status: OK`);
    } else {
    }
  } catch (error) {}
}

async function checkServiceHealth(fetch, agent = null) {
  const healthUrl = "https://gateway-run.bls.dev/health";
  try {
    const response = await fetch(healthUrl, { agent, headers: commonHeaders });
    const data = await response.json();
    if (data.status === "ok") {
      console.log(`[${getFormattedTime()}] 服务健康检查: 正常`);
    } else {
      console.error(`[${getFormattedTime()}] 服务健康检查失败:`, data);
    }
  } catch (error) {
    console.error(`[${getFormattedTime()}] 服务健康检查出错: ${error.message}`);
  }
}

async function pingNode(nodeId, agent, ipAddress, authToken, pingErrorCount) {
  const fetch = await loadFetch();
  const chalk = await import("chalk");
  const pingUrl = `${apiBaseUrl}/nodes/${nodeId}/ping`;

  await checkServiceHealth(fetch, agent);

  let proxyInfo;
  if (connectionOption === 3) {
    proxyInfo = "Fake IP";
  } else {
    proxyInfo = agent ? JSON.stringify(agent.proxy) : "No proxy";
  }

  console.log(
    `[${getFormattedTime()}] Pinging node ${nodeId} using proxy ${proxyInfo}`
  );
  const response = await fetch(pingUrl, {
    method: "POST",
    headers: {
      ...commonHeaders,
      Authorization: `Bearer ${authToken}`,
    },
    agent,
  });

  try {
    const data = await response.json();
    if (!data.status) {
      console.log(
        `[${getFormattedTime()}] ${chalk.default.green(
          "First time ping initiate"
        )}, NodeID: ${chalk.default.cyan(
          nodeId
        )}, Proxy: ${chalk.default.yellow(
          proxyInfo
        )}, IP: ${chalk.default.yellow(ipAddress)}`
      );
    } else {
      let statusColor =
        data.status.toLowerCase() === "ok"
          ? chalk.default.green
          : chalk.default.red;
      const logMessage = `[${getFormattedTime()}] Ping response status: ${statusColor(
        data.status.toUpperCase()
      )}, NodeID: ${chalk.default.cyan(nodeId)}, Proxy: ${chalk.default.yellow(
        proxyInfo
      )}, IP: ${chalk.default.yellow(ipAddress)}`;
      console.log(logMessage);
    }
    pingErrorCount[nodeId] = 0;

    await checkNodeStatus(nodeId, fetch, agent);

    return data;
  } catch (error) {
    const text = await response.text();
    console.error(`[${getFormattedTime()}] 无法解析 JSON。响应文本:`, text);
    pingErrorCount[node.nodeId] = (pingErrorCount[node.nodeId] || 0) + 1;
    throw new Error(`JSON 响应无效: ${text}`);
  }
}

async function displayHeader() {
  const chalk = await import("chalk");
  console.log("");
  console.log(
    chalk.default.yellow(" ========================")
  );
  console.log(
    chalk.default.yellow("|      Bless-bot         |")
  );
  console.log(
    chalk.default.yellow(" ========================")
  );
  console.log("");
}

const activeNodes = new Set();
const nodeIntervals = new Map();

async function processNode(node, agent, ipAddress, authToken) {
  const pingErrorCount = {};
  let intervalId = null;

  while (true) {
    try {
      if (activeNodes.has(node.nodeId)) {
        console.log(`[${getFormattedTime()}] 节点 ${node.nodeId} 正在处理中。`);
        return;
      }

      activeNodes.add(node.nodeId);
      console.log(
        `[${getFormattedTime()}] 正在处理节点: ${node.nodeId}, 硬件ID: ${
          node.hardwareId
        }, IP: ${ipAddress}`
      );

      const registrationResponse = await registerNode(
        node.nodeId,
        node.hardwareId,
        ipAddress,
        agent,
        authToken
      );
      console.log(
        `[${getFormattedTime()}] 节点 ${node.nodeId} 注册完成。响应:`,
        registrationResponse
      );

      const startSessionResponse = await startSession(
        node.nodeId,
        agent,
        authToken
      );
      console.log(
        `[${getFormattedTime()}] 节点 ${node.nodeId} 会话已启动。响应:`,
        startSessionResponse
      );

      console.log(
        `[${getFormattedTime()}] 正在发送节点 ${node.nodeId} 的初始ping`
      );
      await pingNode(node.nodeId, agent, ipAddress, authToken, pingErrorCount);

      if (!nodeIntervals.has(node.nodeId)) {
        intervalId = setInterval(async () => {
          try {
            console.log(
              `[${getFormattedTime()}] 正在发送节点 ${node.nodeId} 的ping`
            );
            await pingNode(
              node.nodeId,
              agent,
              ipAddress,
              authToken,
              pingErrorCount
            );
          } catch (error) {
            console.error(
              `[${getFormattedTime()}] ping过程中出错: ${error.message}`
            );

            pingErrorCount[node.nodeId] =
              (pingErrorCount[node.nodeId] || 0) + 1;
            if (pingErrorCount[node.nodeId] >= MAX_PING_ERRORS) {
              clearInterval(nodeIntervals.get(node.nodeId));
              nodeIntervals.delete(node.nodeId);
              activeNodes.delete(node.nodeId);
              console.error(
                `[${getFormattedTime()}] 节点 ${
                  node.nodeId
                } 连续 ${MAX_PING_ERRORS} 次ping失败。正在重启进程...`
              );
              await new Promise((resolve) =>
                setTimeout(resolve, processRestartDelay)
              );
              await processNode(node, agent, ipAddress, authToken);
            }
          }
        }, pingInterval);
        nodeIntervals.set(node.nodeId, intervalId);
      }

      break;
    } catch (error) {
      if (
        error.message.includes("proxy") ||
        error.message.includes("connect") ||
        error.message.includes("authenticate")
      ) {
        console.error(
          `[${getFormattedTime()}] 节点 ${
            node.nodeId
          } 代理错误，15分钟后重试: ${error.message}`
        );
        setTimeout(
          () => processNode(node, agent, ipAddress, authToken),
          retryDelay
        );
      } else {
        console.error(
          `[${getFormattedTime()}] 节点 ${
            node.nodeId
          } 发生错误，50秒后重启进程: ${error.message}`
        );
        await new Promise((resolve) => setTimeout(resolve, restartDelay));
      }
    } finally {
      activeNodes.delete(node.nodeId);
    }
  }
}

async function runAll(initialRun = true) {
  try {
    if (initialRun) {
      await displayHeader();
      connectionOption = await promptConnectionOption();
    }

    const fetch = await loadFetch();
    let hardwareInfo = await loadHardwareInfo();

    config.forEach((user) => {
      user.nodes.forEach((node) => {
        if (!hardwareInfo[node.nodeId]) {
          hardwareInfo[node.nodeId] = generateRandomHardwareInfo();
        }
      });
    });

    await saveHardwareInfo(hardwareInfo);

    const nodePromises = config.flatMap((user) =>
      user.nodes.map(async (node) => {
        let agent = null;
        let ipAddress = null;

        if (connectionOption === 1 && node.proxy) {
          if (node.proxy.startsWith("socks")) {
            agent = new SocksProxyAgent(node.proxy);
          } else {
            const proxyUrl = node.proxy.startsWith("http")
              ? node.proxy
              : `http://${node.proxy}`;
            agent = new HttpsProxyAgent(proxyUrl);
          }
          ipAddress = await fetchIpAddress(fetch, agent);
        } else {
          ipAddress = await fetchIpAddress(fetch);
        }

        if (ipAddress) {
          await processNode(node, agent, ipAddress, user.usertoken).catch(
            (error) => {
              console.error(
                `[${getFormattedTime()}] 处理节点 ${node.nodeId} 时发生错误: ${
                  error.message
                }`
              );
            }
          );
        } else {
          console.error(
            `[${getFormattedTime()}] 由于IP获取失败跳过节点 ${
              node.nodeId
            }。15分钟后重试。`
          );
          setTimeout(async () => {
            ipAddress = await fetchIpAddress(fetch, agent);
            if (ipAddress) {
              await processNode(node, agent, ipAddress, user.usertoken);
            } else {
              console.error(
                `[${getFormattedTime()}] 再次获取节点 ${
                  node.nodeId
                } 的IP地址失败。`
              );
            }
          }, retryDelay);
        }
      })
    );

    await Promise.allSettled(nodePromises);
  } catch (error) {
    const chalk = await import("chalk");
    console.error(
      chalk.default.yellow(`[${getFormattedTime()}] 发生错误: ${error.message}`)
    );
  }
}

process.on("uncaughtException", (error) => {
  console.error(`[${getFormattedTime()}] 未捕获的异常: ${error.message}`);
  runAll(false);
});

runAll();
