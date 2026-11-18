/**
 * WPS · Cookie 抓取(多账号)
 *
 * 抓取:打开「WPS」APP → 进任意活动页(任务中心/福利中心,如「天天领福利」)→ 自动触发 page_info
 * 存入 wps_sids_list:[{uid, wps_sid, ts}, ...],按 uid 更新
 *
 * @Author: MaYIHEI <https://github.com/MaYIHEI/paperclip>
 * @Channel: Telegram 频道 https://t.me/mayihei
 * @Updated: 2026-11-18
 */

const $ = new Env("WPS [Cookie]");

const LIST_KEY = "wps_sids_list"; // [{uid, wps_sid, ts}, ...],按 uid 更新

(function main() {
    if (typeof $request === "undefined") {
        $.log("[ERROR] 该脚本仅作为 http-request 重写脚本运行");
        $.done();
        return;
    }
    if ($request.method === "OPTIONS") {
        $.done();
        return;
    }

    try {
        // page_info 请求头里带整套 cookie,从中只取 wps_sid(域 wps.cn 的持久登录态,不轮换、无需刷新)
        const cookie = cookieHeader();
        const m = cookie.match(/(?:^|;\s*)wps_sids?=([^;]+)/);
        if (!m) {
            $.log("[WARN] 请求头里没找到 wps_sid,可能该请求未带登录态,换个活动页重试");
            $.done();
            return;
        }
        // 原正则不动;若同时存在精确的 wps_sid=,用它写入(HAR 里 wps_sids 常排在前面且可能是逗号列表)
        const exact = cookie.match(/(?:^|;\s*)wps_sid=([^;]+)/);
        const sid = exact ? exact[1] : m[1];
        if (exact && exact[1] !== m[1]) $.log("[WARN] wps_sids? 命中值与 wps_sid 不同,已按 wps_sid 写入");

        const muid = cookie.match(/(?:^|;\s*)uid=([^;]+)/);
        const uid = muid ? String(muid[1]).trim() : "";
        if (!uid) {
            $.log("[WARN] cookie 里没有 uid,跳过(多账号必须以 uid 为唯一键)");
            $.done();
            return;
        }

        const list = (safeJson($.getdata(LIST_KEY) || "[]") || []).filter((x) => x && x.uid && x.wps_sid);
        const hit = list.find((x) => String(x.uid) === uid);
        if (hit) {
            hit.wps_sid = sid;
            hit.ts = Date.now();
        } else {
            list.push({ uid, wps_sid: sid, ts: Date.now() });
        }
        $.setdata(JSON.stringify(list), LIST_KEY);
        $.setdata("", `wps_status_${uid}`); // 新 Cookie 待签到验证,先撤掉该账号旧体检结果
        $.log(`[INFO] ${hit ? "已更新" : "已新增"} 账号 uid=${uid} wps_sid=${maskSid(sid)},共 ${list.length} 个`);
        $.msg("WPS", "✅ WPS Cookie 获取成功", `uid=${uid},共 ${list.length} 个账号`);
    } catch (e) {
        $.log("[ERROR] cookie 抓取失败: " + e);
    }

    $.done();
})();

// 部分抓包工具会把 Cookie 拆成多个同名头;拼成一条再匹配,不改原正则
function cookieHeader() {
    const h = $request.headers || {};
    const parts = [];
    for (const k of Object.keys(h)) {
        if (k.toLowerCase() !== "cookie") continue;
        const v = h[k];
        if (Array.isArray(v)) parts.push(...v.filter(Boolean));
        else if (v) parts.push(v);
    }
    return parts.join("; ");
}

function safeJson(s) {
    try { return JSON.parse(s); } catch (e) { return null; }
}

function maskSid(s) {
    if (!s || s.length < 12) return "已获取";
    return s.slice(0, 6) + "***" + s.slice(-4);
}

function Env(s) {
    this.name = s;
    this.isSurge = () => typeof $httpClient !== "undefined";
    this.isQuanX = () => typeof $task !== "undefined";
    this.isLoon = () => typeof $loon !== "undefined";
    this.log = (...a) => console.log(a.join("\n"));
    this.msg = (t = this.name, s = "", b = "") => {
        if (this.isSurge() || this.isLoon()) $notification.post(t, s, b);
        else if (this.isQuanX()) $notify(t, s, b);
        console.log(["", "====📣" + t + "====", s, b].filter(Boolean).join("\n"));
    };
    this.getdata = (k) => {
        if (this.isSurge() || this.isLoon()) return $persistentStore.read(k);
        if (this.isQuanX()) return $prefs.valueForKey(k);
        return null;
    };
    this.setdata = (v, k) => {
        if (this.isSurge() || this.isLoon()) return $persistentStore.write(v, k);
        if (this.isQuanX()) return $prefs.setValueForKey(v, k);
        return false;
    };
    this.done = (v = {}) => { if (typeof $done !== "undefined") $done(v); };
}
