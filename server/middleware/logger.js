import logger from '../config/logger.js';

export const requestLogger = (req, res, next) => {
    const start = process.hrtime();
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    res.on('finish', () => {
        const duration = process.hrtime(start);
        const ms = (duration[0] * 1000 + duration[1] / 1e6).toFixed(2);
        const status = res.statusCode;

        // Construct log message
        const message = `${req.method} ${req.url} ${status} ${ms}ms - IP: ${ip}`;

        // Log based on status code
        if (status >= 500) {
            logger.error(message);
        } else if (status >= 400) {
            logger.warn(message);
        } else {
            logger.info(message);
        }
    });

    next();
};

export const handleError = (res, err) => {
    const isProd = process.env.NODE_ENV === 'production';

    // Log the full error stack to Winston (stored in logs/error-*.log)
    logger.error(`[Global Error] ${err.message}`, {
        stack: err.stack,
        url: res.req?.url,
        method: res.req?.method
    });

    // Do not leak stack traces or internal names to client
    if (!res.headersSent) {
        res.status(500).json({
            success: false,
            error: isProd ? 'Internal Server Error' : String(err?.message || err),
            code: 500
        });
    }
};
