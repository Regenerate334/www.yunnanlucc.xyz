export const requestLogger = (req, res, next) => {
    const start = process.hrtime();
    const timestamp = new Date().toISOString();
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    console.log(`\n[${timestamp}] ${req.method} ${req.url} - IP: ${ip}`);

    res.on('finish', () => {
        const duration = process.hrtime(start);
        const ms = (duration[0] * 1000 + duration[1] / 1e6).toFixed(2);
        const status = res.statusCode;
        let statusColor = '\x1b[0m';
        if (status >= 500) statusColor = '\x1b[31m';
        else if (status >= 400) statusColor = '\x1b[33m';
        else if (status >= 200) statusColor = '\x1b[32m';
        console.log(`  Response: ${statusColor}${status}\x1b[0m | Duration: ${ms}ms`);
    });

    next();
};

export const handleError = (res, err) => {
    console.error(err);
    const isProd = process.env.NODE_ENV === 'production';
    res.status(500).json({ error: isProd ? 'Internal server error' : String(err?.message || err) });
};
