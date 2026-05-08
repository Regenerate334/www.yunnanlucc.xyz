/**\n * 请求拦截中间件 (Request Intercepting Middleware)\n * 职责：拦截并加工 HTTP 请求，提供基于 responseHandler 规则的过滤与包装。\n *\n * 修改提示：\n * 1. 本文件为系统底层运行机制的组成部分，修改前请仔细核对依赖关系。\n * 2. 必须在中间件最后调用 next() 或者结束响应，否则会造成请求挂起。\n * 3. 遵循现有的 ESLint 和团队代码规范，保持极简及高可读性。\n */\n/**
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
