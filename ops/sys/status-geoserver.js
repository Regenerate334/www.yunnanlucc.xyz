import http from 'http';

async function check() {
    const GS_URL = 'http://127.0.0.1:8080/geoserver/web/';
    const req = http.get(GS_URL, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
            res.resume();
        } else {
            process.exit(1);
        }
    });
    req.on('error', () => process.exit(1));
    req.setTimeout(5000, () => { req.destroy(); process.exit(1); });
}

check();
setInterval(check, 30000);
