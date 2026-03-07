"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const env_1 = require("./config/env");
const adminRoutes_1 = require("./routes/adminRoutes");
const authRoutes_1 = require("./routes/authRoutes");
const coreDataRoutes_1 = require("./routes/coreDataRoutes");
const customerPortalRoutes_1 = require("./routes/customerPortalRoutes");
const employeeChatRoutes_1 = require("./routes/employeeChatRoutes");
const employeeTreeRoutes_1 = require("./routes/employeeTreeRoutes");
const protectedRoutes_1 = require("./routes/protectedRoutes");
const systemRoutes_1 = require("./routes/systemRoutes");
exports.app = (0, express_1.default)();
exports.app.use((0, cors_1.default)({
    origin: env_1.env.frontendOrigin,
    credentials: true,
}));
exports.app.use(express_1.default.json());
exports.app.use(systemRoutes_1.systemRouter);
exports.app.use("/auth", authRoutes_1.authRouter);
exports.app.use("/data", coreDataRoutes_1.coreDataRouter);
exports.app.use(adminRoutes_1.adminRouter);
exports.app.use(employeeTreeRoutes_1.employeeTreeRouter);
exports.app.use(employeeChatRoutes_1.employeeChatRouter);
exports.app.use(customerPortalRoutes_1.customerPortalRouter);
exports.app.use(protectedRoutes_1.protectedRouter);
exports.app.use((req, res) => {
    res.status(404).json({
        status: "error",
        message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
});
