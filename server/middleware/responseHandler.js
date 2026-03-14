/**
 * responseHandler.js — 统一响应处理中间件
 * 
 * 为 res 对象注入 success 和 error 方法，规范返回结构：
 * { success: boolean, data: any, message: string, timestamp: string }
 */

export const responseHandler = (req, res, next) => {
    /**
     * 成功响应
     */
    res.success = (data = null, message = 'success') => {
        res.status(200).json({
            success: true,
            data,
            message,
            timestamp: new Date().toISOString()
        });
    };

    /**
     * 错误响应
     */
    res.error = (message = 'error', code = 500, error = null) => {
        const response = {
            success: false,
            data: null,
            message,
            timestamp: new Date().toISOString()
        };

        if (process.env.NODE_ENV === 'development' && error) {
            response.devError = error.message || error;
        }

        res.status(code).json(response);
    };

    next();
};

export default responseHandler;
