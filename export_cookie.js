function exportBiliCookie() {
    const hostname = window.location.hostname;
    console.log('%c🍰 正在导出Cookie...', 'font-size: 14px; color: #fb7299;');
    console.log('%c当前域名: ' + hostname, 'color: #999;');

    const cookies = document.cookie.split(';').map(c => c.trim()).filter(c => c);
    console.log('%c找到 ' + cookies.length + ' 个Cookie', 'color: #999;');

    if (cookies.length === 0) {
        console.log('%c❌ 未找到任何Cookie', 'color: #fb7299;');
        console.log('%c💡 提示: 请确保在 bilibili.com 相关域名下执行此脚本', 'color: #999;');
        return '';
    }

    const result = cookies.join('; ');
    console.log('%c📋 Cookie内容:', 'font-weight: bold; color: #00a1d6;');
    console.log('%c' + result, 'color: #00a1d6; font-family: monospace;');

    const blob = new Blob([result], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'BiliTube_cookie.txt';
    a.click();
    URL.revokeObjectURL(url);
    console.log('%c✅ 已下载Cookie文件', 'color: #23ade5;');

    const envFormat = `BiliTube_cookie="${result}"`;
    console.log('%c📋 .env格式:', 'font-weight: bold; color: #23ade5;');
    console.log('%c' + envFormat, 'color: #23ade5;');

    if (confirm('是否复制.env格式到剪贴板？')) {
        navigator.clipboard.writeText(envFormat).then(() => {
            console.log('%c✅ 已复制到剪贴板', 'color: #23ade5;');
        }).catch(() => {
            console.log('%c❌ 复制失败，请手动复制', 'color: #fb7299;');
        });
    }

    return result;
}

function exportAllBiliCookies() {
    const result = exportBiliCookie();

    const jsonOutput = {
        url: window.location.href,
        hostname: window.location.hostname,
        cookie: result,
        envFormat: `BiliTube_cookie="${result}"`
    };

    console.log('%c📦 JSON格式:', 'font-weight: bold; color: #fb7299;');
    console.log(JSON.stringify(jsonOutput, null, 2));
}

console.log('%c🍰 BiliTube Cookie Exporter', 'font-size: 16px; font-weight: bold; color: #fb7299;');
console.log('%c当前页面: ' + window.location.href, 'color: #999;');
console.log('%c按 Enter 导出Cookie...', 'color: #23ade5;');

exportAllBiliCookies();
