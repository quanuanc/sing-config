let config = JSON.parse($files[0]);
let mainProxies = await produceArtifact({
  name: "X1",
  type: "collection",
  platform: "sing-box",
  produceType: "internal",
});
let secondaryProxies = await produceArtifact({
  name: "X2",
  type: "collection",
  platform: "sing-box",
  produceType: "internal",
});
let usProxies = await produceArtifact({
  name: "US",
  type: "collection",
  platform: "sing-box",
  produceType: "internal",
});


processSubscribe(config, mainProxies, secondaryProxies, usProxies);
processTailscale(config);

$content = JSON.stringify(config, null, 2);

// util functions
function processSubscribe(config, mainProxies, secondaryProxies, usProxies) {
  let filteredProxies = new Set();
  let xFilter = null;
  let hkFilter = /香港|HK/i;
  let usFilter = /美国|USA/i;

  config.outbounds.forEach((i) => {
    if (["x1"].includes(i.tag)) {
      const tags = getTags(mainProxies, xFilter);
      i.outbounds.push(...tags);
      tags.forEach((t) => filteredProxies.add(t));
    }
    if (["x2"].includes(i.tag)) {
      const tags = getTags(secondaryProxies, xFilter);
      i.outbounds.push(...tags);
      tags.forEach((t) => filteredProxies.add(t));
    }
    if (["hk"].includes(i.tag)) {
      const tags = getTags(mainProxies, hkFilter);
      i.outbounds.push(...tags);
      tags.forEach((t) => filteredProxies.add(t));
    }
    if (["hk"].includes(i.tag)) {
      const tags = getTags(secondaryProxies, hkFilter);
      i.outbounds.push(...tags);
      tags.forEach((t) => filteredProxies.add(t));
    }
    if (["us"].includes(i.tag)) {
      const tags = getTags(usProxies, usFilter);
      i.outbounds.push(...tags);
      tags.forEach((t) => filteredProxies.add(t));
    }
  });

  mainProxies.forEach((proxy) => {
    if (filteredProxies.has(proxy.tag)) {
      config.outbounds.push(proxy);
    }
  });
  secondaryProxies.forEach((proxy) => {
    if (filteredProxies.has(proxy.tag)) {
      config.outbounds.push(proxy);
    }
  });
  usProxies.forEach((proxy) => {
    if (filteredProxies.has(proxy.tag)) {
      config.outbounds.push(proxy);
    }
  });

  config.outbounds.forEach((outbound) => {
    if (Array.isArray(outbound.outbounds) && outbound.outbounds.length === 0) {
      outbound.outbounds.push("direct");
    }
  });

  // 去重 config.outbounds，依据 outbound.tag，保留第一次出现的顺序
  dedupeOutbounds(config);
}

function getTags(proxies, regex) {
  return (regex ? proxies.filter((p) => regex.test(p.tag)) : proxies).map(
    (p) => p.tag,
  );
}

function processTailscale(config) {
  if (config.endpoints === undefined) return;
  const tsHost = $arguments.ts_host;
  if (tsHost === undefined) return;
  const tsKey = $arguments.ts_key;
  if (tsKey === undefined) {
    console.log("ts_key not set for ts_host: " + tsHost);
  }
  if (tsHost === "no-ts") {
    removeTailscale(config);
  }
  const tsExitNode = $arguments.ts_exit_node;
  const tsAdvertiseExit = $arguments.ts_advertise_exit;
  config.endpoints.forEach((ep) => {
    if (ep.type === "tailscale") {
      ep.hostname = tsHost;
      ep.auth_key = tsKey;
      ep.exit_node = tsExitNode;
    }
  });
  if (tsExitNode === undefined) {
    // delete config ep exit_node
    config.endpoints.forEach((ep) => {
      if (ep.type === "tailscale") {
        delete ep.exit_node;
      }
    });
  }
  if (tsAdvertiseExit === undefined) {
    // delete config ep advertise_exit_node
    config.endpoints.forEach((ep) => {
      if (ep.type === "tailscale") {
        delete ep.advertise_exit_node;
      }
    });
  }
}

function removeTailscale(config) {
  let tsTag;
  // endpoints
  if (config.endpoints) {
    config.endpoints.forEach((ep) => {
      if (ep.type === "tailscale") {
        tsTag = ep.tag;
      }
    });
    config.endpoints = config.endpoints.filter((ep) => ep.type !== "tailscale");
  }
  // dns
  if (config.dns) {
    if (config.dns.servers) {
      config.dns.servers = config.dns.servers.filter(
        (dnsServer) => dnsServer.endpoint !== tsTag,
      );
    }
    if (config.dns.rules) {
      config.dns.rules = config.dns.rules.filter(
        (dnsRule) => dnsRule.server !== tsTag,
      );
    }
  }
  // route
  if (config.route) {
    config.route.rules = config.route.rules.filter(
      (rule) => rule.outbound !== tsTag,
    );
  }
}

// 根据 outbound.tag 去重 config.outbounds，保留第一次出现的 outbound
function dedupeOutbounds(config) {
  if (!config || !Array.isArray(config.outbounds)) return;
  const seen = new Set();
  const result = [];
  for (const outbound of config.outbounds) {
    // 如果没有 tag 字段或 tag 不是字符串，直接保留（无法进行按 tag 去重）
    if (!outbound || typeof outbound.tag !== "string") {
      result.push(outbound);
      continue;
    }
    if (!seen.has(outbound.tag)) {
      seen.add(outbound.tag);
      result.push(outbound);
    } else {
      // 已存在相同 tag 的 outbound，跳过（如果需要合并行为，可在此处扩展）
    }
  }
  config.outbounds = result;
}
