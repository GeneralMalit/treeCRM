"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = requireRole;
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                status: "error",
                message: "Authentication is required.",
            });
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({
                status: "error",
                message: `Access denied for role '${req.user.role}'.`,
            });
            return;
        }
        next();
    };
}
