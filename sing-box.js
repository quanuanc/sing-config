let config = JSON.parse($files[0]);
let mainProxies = await produceArtifact({
  name: "Main",
  type: "collection",
  platform: "sing-box",
  produceType: "internal",
});
let basicProxies = await produceArtifact({
  name: "Basic-Sing",
  type: "collection",
  platform: "sing-box",
  produceType: "internal",
});

processSubscribe(config, mainProxies, basicProxies);
processTailscale(config);
processTethering(config);

$content = JSON.stringify(config, null, 2);

// util functions
function processSubscribe(config, mainProxies, basicProxies) {
  let filteredProxies = new Set();
  let xFilter = /香港|日本|新加坡|台湾|HK|TW|SG|JP/i;
  let hkFilter = /香港|HK/i;
  let usFilter = /美国|USA/i;

  config.outbounds.forEach((i) => {
    if (["x1"].includes(i.tag)) {
      const tags = getTags(mainProxies, xFilter);
      i.outbounds.push(...tags);
      tags.forEach((t) => filteredProxies.add(t));
    }
    if (["x2"].includes(i.tag)) {
      const tags = getTags(basicProxies, xFilter);
      i.outbounds.push(...tags);
      tags.forEach((t) => filteredProxies.add(t));
    }
    if (["hk"].includes(i.tag)) {
      const tags = getTags(mainProxies, hkFilter);
      i.outbounds.push(...tags);
      tags.forEach((t) => filteredProxies.add(t));
    }
    if (["hk"].includes(i.tag)) {
      const tags = getTags(basicProxies, hkFilter);
      i.outbounds.push(...tags);
      tags.forEach((t) => filteredProxies.add(t));
    }
    if (["us"].includes(i.tag)) {
      const tags = getTags(mainProxies, usFilter);
      i.outbounds.push(...tags);
      tags.forEach((t) => filteredProxies.add(t));
    }
    if (["us"].includes(i.tag)) {
      const tags = getTags(basicProxies, usFilter);
      i.outbounds.push(...tags);
      tags.forEach((t) => filteredProxies.add(t));
    }
  });

  mainProxies.forEach((proxy) => {
    if (filteredProxies.has(proxy.tag)) {
      config.outbounds.push(proxy);
    }
  });
  basicProxies.forEach((proxy) => {
    if (filteredProxies.has(proxy.tag)) {
      config.outbounds.push(proxy);
    }
  });

  config.outbounds.forEach((outbound) => {
    if (Array.isArray(outbound.outbounds) && outbound.outbounds.length === 0) {
      outbound.outbounds.push("direct");
    }
  });
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
  if (tsHost === "vim") {
    removeTailscale(config);
  }
  config.endpoints.forEach((ep) => {
    if (ep.type === "tailscale") {
      ep.hostname = tsHost;
      ep.auth_key = tsKey;
    }
  });
}

function processTethering(config) {
  let tethering = $arguments.tethering;
  if (tethering === undefined) tethering = false;
  if (tethering) {
    config.inbounds = config.inbounds.filter(
      (inbound) => inbound.type !== "tun",
    );
  } else {
    config.inbounds = config.inbounds.filter(
      (inbound) => inbound.type !== "tproxy",
    );
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
