"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ROLE = exports.ROLES = void 0;
exports.isRole = isRole;
exports.ROLES = ["CSR", "Manager", "Executive", "Admin", "Customer"];
exports.DEFAULT_ROLE = "Customer";
function isRole(value) {
    return typeof value === "string" && exports.ROLES.includes(value);
}
