"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.employeeTreeRouter = void 0;
const express_1 = __importDefault(require("express"));
const roles_1 = require("../constants/roles");
const employeeTreeLogic_1 = require("../domain/employeeTreeLogic");
const requireAuth_1 = require("../middleware/requireAuth");
const requireRole_1 = require("../middleware/requireRole");
const notificationService_1 = require("../services/notificationService");
const supabaseClient_1 = require("../services/supabaseClient");
const STATUS_VALUES = ["Open", "In Progress", "Resolved", "Dropped"];
const PRIORITY_VALUES = ["High", "Medium", "Low"];
const ENDORSEMENT_STATUS_VALUES = ["Pending", "Accepted", "Rejected", "Cancelled"];
const ENDORSEMENT_TARGET_ROLES = ["Manager", "Executive"];
const CASE_REASSIGN_ROLES = ["Manager", "Executive", "Admin"];
const CUSTOM_TAG_DEFAULT_COLOR = "#6B7280";
const VISIBLE_EMPLOYEE_ROLES = {
    CSR: ["CSR"],
    Manager: ["CSR", "Manager"],
    Executive: ["CSR", "Manager", "Executive"],
    Admin: ["CSR", "Manager", "Executive", "Admin"],
};
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isCaseStatus(value) {
    return typeof value === "string" && STATUS_VALUES.includes(value);
}
function isCasePriority(value) {
    return typeof value === "string" && PRIORITY_VALUES.includes(value);
}
function isEndorsementStatus(value) {
    return (typeof value === "string" &&
        ENDORSEMENT_STATUS_VALUES.includes(value));
}
function toUserRows(rows) {
    return rows
        .filter((row) => isRecord(row))
        .filter((row) => {
        return (typeof row.id === "string" &&
            typeof row.email === "string" &&
            (0, roles_1.isRole)(row.role) &&
            typeof row.created_at === "string" &&
            (typeof row.manager_id === "string" || row.manager_id === null || typeof row.manager_id === "undefined") &&
            (typeof row.name === "string" || row.name === null));
    })
        .map((row) => ({
        id: String(row.id),
        email: String(row.email),
        name: row.name === null ? null : String(row.name),
        role: row.role,
        manager_id: row.manager_id === null || typeof row.manager_id === "undefined" ? null : String(row.manager_id),
        created_at: String(row.created_at),
    }));
}
function toCustomerRows(rows) {
    return rows
        .filter((row) => isRecord(row))
        .filter((row) => {
        return (typeof row.id === "string" &&
            typeof row.user_id === "string" &&
            typeof row.company === "string" &&
            typeof row.created_at === "string" &&
            isRecord(row.contact_info));
    })
        .map((row) => ({
        id: String(row.id),
        user_id: String(row.user_id),
        company: String(row.company),
        contact_info: row.contact_info,
        created_at: String(row.created_at),
    }));
}
function toCaseRows(rows) {
    return rows
        .filter((row) => isRecord(row))
        .filter((row) => {
        return (typeof row.id === "string" &&
            typeof row.customer_id === "string" &&
            (typeof row.assigned_to === "string" || row.assigned_to === null) &&
            typeof row.title === "string" &&
            typeof row.description === "string" &&
            typeof row.created_at === "string" &&
            typeof row.updated_at === "string" &&
            (typeof row.customer_satisfaction_rating === "number" ||
                row.customer_satisfaction_rating === null ||
                typeof row.customer_satisfaction_rating === "undefined") &&
            isCaseStatus(row.status) &&
            isCasePriority(row.priority));
    })
        .map((row) => ({
        id: String(row.id),
        customer_id: String(row.customer_id),
        assigned_to: row.assigned_to === null ? null : String(row.assigned_to),
        title: String(row.title),
        description: String(row.description),
        status: row.status,
        priority: row.priority,
        customer_satisfaction_rating: typeof row.customer_satisfaction_rating === "number" &&
            row.customer_satisfaction_rating >= 1 &&
            row.customer_satisfaction_rating <= 5
            ? Math.round(row.customer_satisfaction_rating)
            : null,
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
    }));
}
function toTagRows(rows) {
    return rows
        .filter((row) => isRecord(row))
        .filter((row) => {
        return (typeof row.id === "string" &&
            typeof row.name === "string" &&
            typeof row.color === "string" &&
            typeof row.affects_node_color === "boolean");
    })
        .map((row) => ({
        id: String(row.id),
        name: String(row.name),
        color: String(row.color),
        affects_node_color: Boolean(row.affects_node_color),
    }));
}
function toCaseTagRows(rows) {
    return rows
        .filter((row) => isRecord(row))
        .filter((row) => typeof row.tag_id === "string")
        .map((row) => ({
        tag_id: String(row.tag_id),
    }));
}
function toInternalNoteRows(rows) {
    return rows
        .filter((row) => isRecord(row))
        .filter((row) => {
        return (typeof row.id === "string" &&
            (typeof row.sender_id === "string" || row.sender_id === null) &&
            (0, roles_1.isRole)(row.sender_role) &&
            typeof row.message_text === "string" &&
            typeof row.created_at === "string");
    })
        .map((row) => ({
        id: String(row.id),
        sender_id: row.sender_id === null ? null : String(row.sender_id),
        sender_role: row.sender_role,
        message_text: String(row.message_text),
        created_at: String(row.created_at),
    }));
}
function toEndorsementRows(rows) {
    return rows
        .filter((row) => isRecord(row))
        .filter((row) => {
        return (typeof row.id === "string" &&
            typeof row.case_id === "string" &&
            typeof row.endorsed_by === "string" &&
            typeof row.endorsed_to === "string" &&
            typeof row.created_at === "string" &&
            isEndorsementStatus(row.status));
    })
        .map((row) => ({
        id: String(row.id),
        case_id: String(row.case_id),
        endorsed_by: String(row.endorsed_by),
        endorsed_to: String(row.endorsed_to),
        status: row.status,
        created_at: String(row.created_at),
    }));
}
function getDisplayName(user) {
    if (typeof user.name === "string" && user.name.trim()) {
        return user.name.trim();
    }
    return user.email;
}
function getRoleSortWeight(role) {
    switch (role) {
        case "Executive":
            return 1;
        case "Manager":
            return 2;
        case "CSR":
            return 3;
        case "Admin":
            return 4;
        case "Customer":
            return 5;
        default:
            return 99;
    }
}
function getPrioritySortWeight(priority) {
    switch (priority) {
        case "High":
            return 1;
        case "Medium":
            return 2;
        case "Low":
            return 3;
        default:
            return 99;
    }
}
function ensureSupabase() {
    if (!supabaseClient_1.hasSupabaseAdmin || !supabaseClient_1.supabaseAdmin) {
        return null;
    }
    return supabaseClient_1.supabaseAdmin;
}
function parseInternalNoteCreateBody(body) {
    if (!isRecord(body)) {
        return { error: "Request body must be a JSON object." };
    }
    if (typeof body.messageText !== "string") {
        return { error: "messageText must be a string." };
    }
    const messageText = body.messageText.trim();
    if (!messageText) {
        return { error: "messageText cannot be empty." };
    }
    return { data: { messageText } };
}
function parseCaseIdParam(rawValue) {
    if (typeof rawValue !== "string") {
        return { error: "caseId must be a valid UUID." };
    }
    if (!(0, employeeTreeLogic_1.isUuid)(rawValue)) {
        return { error: "caseId must be a valid UUID." };
    }
    return { data: rawValue };
}
function parseEndorsementIdParam(rawValue) {
    if (typeof rawValue !== "string") {
        return { error: "endorsementId must be a valid UUID." };
    }
    if (!(0, employeeTreeLogic_1.isUuid)(rawValue)) {
        return { error: "endorsementId must be a valid UUID." };
    }
    return { data: rawValue };
}
async function fetchCase(caseId) {
    const client = ensureSupabase();
    if (!client) {
        return {
            error: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee tree queries.",
        };
    }
    const result = await client
        .from("cases")
        .select("id,customer_id,assigned_to,title,description,status,priority,customer_satisfaction_rating,created_at,updated_at")
        .eq("id", caseId)
        .maybeSingle();
    if (result.error) {
        return { error: result.error.message };
    }
    if (!result.data) {
        return { data: null };
    }
    const parsed = toCaseRows([result.data])[0];
    if (!parsed) {
        return { error: "Failed to parse case payload." };
    }
    return { data: parsed };
}
function toWorkflowUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
    };
}
function mapCase(caseItem, pendingSummary) {
    const summary = pendingSummary ?? { hasPendingEndorsement: false, pendingEndorsementCount: 0 };
    return {
        id: caseItem.id,
        customerId: caseItem.customer_id,
        assignedTo: caseItem.assigned_to,
        title: caseItem.title,
        description: caseItem.description,
        status: caseItem.status,
        priority: caseItem.priority,
        createdAt: caseItem.created_at,
        updatedAt: caseItem.updated_at,
        hasPendingEndorsement: summary.hasPendingEndorsement,
        pendingEndorsementCount: summary.pendingEndorsementCount,
    };
}
function mapCaseTagOptions(tags, caseTags) {
    const selectedTagIds = new Set(caseTags.map((row) => row.tag_id));
    return tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        affectsNodeColor: tag.affects_node_color,
        selected: selectedTagIds.has(tag.id),
    }));
}
async function loadCaseTagOptions(client, caseId) {
    const [tagsResult, caseTagsResult] = await Promise.all([
        client.from("tags").select("id,name,color,affects_node_color").order("name", { ascending: true }),
        client.from("case_tags").select("tag_id").eq("case_id", caseId),
    ]);
    if (tagsResult.error || caseTagsResult.error) {
        return {
            error: tagsResult.error?.message ??
                caseTagsResult.error?.message ??
                "Failed to load updated tags.",
        };
    }
    const tags = toTagRows((tagsResult.data ?? []));
    const caseTags = toCaseTagRows((caseTagsResult.data ?? []));
    return { data: mapCaseTagOptions(tags, caseTags) };
}
async function resolveOrCreateCustomTags(client, customTagNames) {
    if (customTagNames.length === 0) {
        return { data: [] };
    }
    const allTagsResult = await client
        .from("tags")
        .select("id,name,color,affects_node_color")
        .order("name", { ascending: true });
    if (allTagsResult.error) {
        return { error: allTagsResult.error.message };
    }
    const allTags = toTagRows((allTagsResult.data ?? []));
    const tagByLowerName = new Map(allTags.map((tag) => [tag.name.trim().toLowerCase(), tag]));
    const missingNames = customTagNames.filter((name) => !tagByLowerName.has(name.toLowerCase()));
    if (missingNames.length > 0) {
        const insertResult = await client
            .from("tags")
            .insert(missingNames.map((name) => ({
            name,
            color: CUSTOM_TAG_DEFAULT_COLOR,
            affects_node_color: false,
        })))
            .select("id,name,color,affects_node_color");
        if (insertResult.error) {
            const refetchResult = await client
                .from("tags")
                .select("id,name,color,affects_node_color")
                .order("name", { ascending: true });
            if (!refetchResult.error) {
                const refetchedTags = toTagRows((refetchResult.data ?? []));
                const refetchedByLowerName = new Map(refetchedTags.map((tag) => [tag.name.trim().toLowerCase(), tag]));
                const allResolved = customTagNames.every((name) => refetchedByLowerName.has(name.toLowerCase()));
                if (allResolved) {
                    return {
                        data: customTagNames
                            .map((name) => refetchedByLowerName.get(name.toLowerCase()) ?? null)
                            .filter((tag) => tag !== null),
                    };
                }
            }
            return { error: insertResult.error.message };
        }
        for (const createdTag of toTagRows((insertResult.data ?? []))) {
            tagByLowerName.set(createdTag.name.trim().toLowerCase(), createdTag);
        }
    }
    return {
        data: customTagNames
            .map((name) => tagByLowerName.get(name.toLowerCase()) ?? null)
            .filter((tag) => tag !== null),
    };
}
async function fetchUsersMapByIds(client, userIds) {
    if (userIds.length === 0) {
        return { data: new Map() };
    }
    const dedupedUserIds = Array.from(new Set(userIds));
    const usersResult = await client
        .from("users")
        .select("id,email,name,role,manager_id,created_at")
        .in("id", dedupedUserIds);
    if (usersResult.error) {
        return { error: usersResult.error.message };
    }
    const users = toUserRows((usersResult.data ?? []));
    return { data: new Map(users.map((user) => [user.id, user])) };
}
function mapEndorsementForResponse(endorsement, usersById, viewerId) {
    const endorsedByUser = usersById.get(endorsement.endorsed_by);
    const endorsedToUser = usersById.get(endorsement.endorsed_to);
    if (!endorsedByUser || !endorsedToUser) {
        return null;
    }
    return {
        id: endorsement.id,
        caseId: endorsement.case_id,
        status: endorsement.status,
        createdAt: endorsement.created_at,
        endorsedBy: toWorkflowUser(endorsedByUser),
        endorsedTo: toWorkflowUser(endorsedToUser),
        isPendingForViewer: endorsement.status === "Pending" && endorsement.endorsed_to === viewerId,
    };
}
const router = express_1.default.Router();
router.get("/employee/tree", requireAuth_1.requireAuth, (0, requireRole_1.requireRole)("CSR", "Manager", "Executive", "Admin"), async (req, res) => {
    const client = ensureSupabase();
    if (!client) {
        res.status(500).json({
            status: "error",
            message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee tree queries.",
        });
        return;
    }
    const viewer = req.user;
    if (!viewer) {
        res.status(401).json({
            status: "error",
            message: "Authentication is required.",
        });
        return;
    }
    const visibleRoles = VISIBLE_EMPLOYEE_ROLES[viewer.role];
    if (!visibleRoles) {
        res.status(403).json({
            status: "error",
            message: `Access denied for role '${viewer.role}'.`,
        });
        return;
    }
    const [usersResult, customersResult, casesResult] = await Promise.all([
        client.from("users").select("id,email,name,role,manager_id,created_at").in("role", visibleRoles),
        client.from("customers").select("id,user_id,company,contact_info,created_at"),
        client
            .from("cases")
            .select("id,customer_id,assigned_to,title,description,status,priority,customer_satisfaction_rating,created_at,updated_at")
            .not("assigned_to", "is", null),
    ]);
    if (usersResult.error || customersResult.error || casesResult.error) {
        res.status(500).json({
            status: "error",
            message: usersResult.error?.message ??
                customersResult.error?.message ??
                casesResult.error?.message ??
                "Failed to load employee tree.",
        });
        return;
    }
    const users = toUserRows((usersResult.data ?? []));
    const customers = toCustomerRows((customersResult.data ?? []));
    const cases = toCaseRows((casesResult.data ?? []));
    const userMap = new Map(users.map((user) => [user.id, user]));
    if (viewer.role === "CSR" && !userMap.has(viewer.sub)) {
        userMap.set(viewer.sub, {
            id: viewer.sub,
            email: viewer.email,
            name: viewer.name ?? null,
            role: "CSR",
            manager_id: null,
            created_at: new Date().toISOString(),
        });
    }
    const scopedCasesForMetrics = cases.filter((caseItem) => {
        if (viewer.role === "CSR") {
            return caseItem.assigned_to === viewer.sub;
        }
        return typeof caseItem.assigned_to === "string" && userMap.has(caseItem.assigned_to);
    });
    const visibleCasesForTree = viewer.role === "CSR"
        ? scopedCasesForMetrics.filter((caseItem) => caseItem.status !== "Resolved")
        : scopedCasesForMetrics;
    const caseIdsInScope = scopedCasesForMetrics.map((caseItem) => caseItem.id);
    let pendingEndorsements = [];
    if (caseIdsInScope.length > 0) {
        const pendingEndorsementsResult = await client
            .from("endorsements")
            .select("id,case_id,endorsed_by,endorsed_to,status,created_at")
            .eq("status", "Pending")
            .in("case_id", caseIdsInScope);
        if (pendingEndorsementsResult.error) {
            res.status(500).json({
                status: "error",
                message: pendingEndorsementsResult.error.message,
            });
            return;
        }
        pendingEndorsements = toEndorsementRows((pendingEndorsementsResult.data ?? []));
    }
    const pendingEndorsementCountByCaseId = new Map();
    for (const endorsement of pendingEndorsements) {
        const current = pendingEndorsementCountByCaseId.get(endorsement.case_id) ?? 0;
        pendingEndorsementCountByCaseId.set(endorsement.case_id, current + 1);
    }
    const customersById = new Map(customers.map((customer) => [customer.id, customer]));
    const casesByEmployeeIdForMetrics = new Map();
    for (const caseItem of scopedCasesForMetrics) {
        if (!caseItem.assigned_to) {
            continue;
        }
        const current = casesByEmployeeIdForMetrics.get(caseItem.assigned_to) ?? [];
        current.push(caseItem);
        casesByEmployeeIdForMetrics.set(caseItem.assigned_to, current);
    }
    const casesByEmployeeIdForTree = new Map();
    for (const caseItem of visibleCasesForTree) {
        if (!caseItem.assigned_to) {
            continue;
        }
        const current = casesByEmployeeIdForTree.get(caseItem.assigned_to) ?? [];
        current.push(caseItem);
        casesByEmployeeIdForTree.set(caseItem.assigned_to, current);
    }
    const employeeIds = viewer.role === "CSR"
        ? [viewer.sub]
        : Array.from(userMap.values()).map((employee) => employee.id);
    const employees = employeeIds
        .map((employeeId) => userMap.get(employeeId))
        .filter((employee) => Boolean(employee))
        .sort((a, b) => {
        const roleCompare = getRoleSortWeight(a.role) - getRoleSortWeight(b.role);
        if (roleCompare !== 0) {
            return roleCompare;
        }
        return (a.name ?? a.email).localeCompare(b.name ?? b.email);
    });
    const resolvedTodayThresholdEpoch = (0, employeeTreeLogic_1.getStartOfUtcDayEpoch)();
    const emptyMetrics = (0, employeeTreeLogic_1.aggregatePerformanceMetrics)([]);
    const employeeMetricsById = new Map(employees.map((employee) => [
        employee.id,
        (0, employeeTreeLogic_1.buildPerformanceMetrics)(casesByEmployeeIdForMetrics.get(employee.id) ?? [], resolvedTodayThresholdEpoch),
    ]));
    const csrEmployees = employees.filter((employee) => employee.role === "CSR");
    const managerEmployees = employees.filter((employee) => employee.role === "Manager");
    const csrMetricsById = new Map(csrEmployees.map((csr) => [csr.id, employeeMetricsById.get(csr.id) ?? emptyMetrics]));
    const managerAssignments = (0, employeeTreeLogic_1.buildManagerCsrAssignments)(managerEmployees, csrEmployees, csrMetricsById);
    const managerAggregates = managerEmployees.map((manager) => {
        const teamCsrIds = managerAssignments.csrIdsByManagerId.get(manager.id) ?? [];
        const teamMetrics = (0, employeeTreeLogic_1.aggregatePerformanceMetrics)(teamCsrIds.map((csrId) => csrMetricsById.get(csrId) ?? emptyMetrics));
        return {
            managerId: manager.id,
            managerName: manager.name,
            managerEmail: manager.email,
            csrCount: teamCsrIds.length,
            metrics: teamMetrics,
        };
    });
    const managerAggregateScope = viewer.role === "Executive" || viewer.role === "Admin"
        ? {
            allocationMode: managerAssignments.mode,
            managerCount: managerEmployees.length,
            csrCount: csrEmployees.length,
            unassignedCsrCount: managerAssignments.unassignedCsrIds.length,
            metrics: (0, employeeTreeLogic_1.aggregatePerformanceMetrics)(managerAggregates.map((entry) => entry.metrics)),
            unassignedMetrics: (0, employeeTreeLogic_1.aggregatePerformanceMetrics)(managerAssignments.unassignedCsrIds.map((csrId) => csrMetricsById.get(csrId) ?? emptyMetrics)),
            managers: managerAggregates,
        }
        : undefined;
    const viewerTeamMetrics = viewer.role === "Manager"
        ? (() => {
            const teamCsrIds = managerAssignments.csrIdsByManagerId.get(viewer.sub) ?? [];
            const teamMetrics = (0, employeeTreeLogic_1.aggregatePerformanceMetrics)(teamCsrIds.map((csrId) => csrMetricsById.get(csrId) ?? emptyMetrics));
            return {
                managerId: viewer.sub,
                csrCount: teamCsrIds.length,
                allocationMode: managerAssignments.mode,
                metrics: teamMetrics,
            };
        })()
        : undefined;
    const scopeMetrics = (0, employeeTreeLogic_1.aggregatePerformanceMetrics)(Array.from(employeeMetricsById.values()));
    const tree = employees.map((employee) => {
        const employeeCases = (casesByEmployeeIdForTree.get(employee.id) ?? []).sort((a, b) => {
            const priorityCompare = getPrioritySortWeight(a.priority) - getPrioritySortWeight(b.priority);
            if (priorityCompare !== 0) {
                return priorityCompare;
            }
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
        const customersForEmployee = new Map();
        for (const caseItem of employeeCases) {
            const customer = customersById.get(caseItem.customer_id);
            if (!customer) {
                continue;
            }
            const existing = customersForEmployee.get(customer.id);
            if (existing) {
                existing.cases.push(caseItem);
                continue;
            }
            customersForEmployee.set(customer.id, {
                id: customer.id,
                userId: customer.user_id,
                company: customer.company,
                contactInfo: customer.contact_info,
                createdAt: customer.created_at,
                cases: [caseItem],
            });
        }
        const customersSorted = Array.from(customersForEmployee.values())
            .sort((a, b) => a.company.localeCompare(b.company))
            .map((customer) => ({
            ...customer,
            cases: customer.cases.map((caseItem) => mapCase(caseItem, {
                hasPendingEndorsement: (pendingEndorsementCountByCaseId.get(caseItem.id) ?? 0) > 0,
                pendingEndorsementCount: pendingEndorsementCountByCaseId.get(caseItem.id) ?? 0,
            })),
        }));
        return {
            id: employee.id,
            name: employee.name,
            email: employee.email,
            role: employee.role,
            managerId: employee.manager_id,
            createdAt: employee.created_at,
            metrics: employeeMetricsById.get(employee.id) ?? emptyMetrics,
            customers: customersSorted,
        };
    });
    const visibleCustomerIds = new Set();
    for (const employeeNode of tree) {
        for (const customerNode of employeeNode.customers) {
            visibleCustomerIds.add(customerNode.id);
        }
    }
    const scope = {
        viewerId: viewer.sub,
        viewerRole: viewer.role,
        employeeCount: tree.length,
        customerCount: visibleCustomerIds.size,
        caseCount: visibleCasesForTree.length,
        metrics: scopeMetrics,
    };
    if (viewerTeamMetrics) {
        scope.teamMetrics = viewerTeamMetrics;
    }
    if (managerAggregateScope) {
        scope.managerAggregates = managerAggregateScope;
    }
    res.json({
        status: "ok",
        scope,
        data: tree,
    });
});
router.get("/employee/cases/:caseId/manage", requireAuth_1.requireAuth, (0, requireRole_1.requireRole)("CSR"), async (req, res) => {
    const client = ensureSupabase();
    if (!client) {
        res.status(500).json({
            status: "error",
            message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee tree queries.",
        });
        return;
    }
    const viewer = req.user;
    if (!viewer) {
        res.status(401).json({
            status: "error",
            message: "Authentication is required.",
        });
        return;
    }
    const caseId = parseCaseIdParam(req.params.caseId);
    if ("error" in caseId) {
        res.status(400).json({
            status: "error",
            message: caseId.error,
        });
        return;
    }
    const caseResult = await fetchCase(caseId.data);
    if ("error" in caseResult) {
        res.status(500).json({
            status: "error",
            message: caseResult.error,
        });
        return;
    }
    if (!caseResult.data) {
        res.status(404).json({
            status: "error",
            message: "Case not found.",
        });
        return;
    }
    if (caseResult.data.assigned_to !== viewer.sub) {
        res.status(403).json({
            status: "error",
            message: "You can only manage cases assigned to your account.",
        });
        return;
    }
    const [tagOptionsResult, notesResult] = await Promise.all([
        loadCaseTagOptions(client, caseId.data),
        client
            .from("messages")
            .select("id,sender_id,sender_role,message_text,created_at")
            .eq("case_id", caseId.data)
            .eq("message_type", "internal_note")
            .order("created_at", { ascending: false }),
    ]);
    if ("error" in tagOptionsResult || notesResult.error) {
        res.status(500).json({
            status: "error",
            message: ("error" in tagOptionsResult ? tagOptionsResult.error : undefined) ??
                notesResult.error?.message ??
                "Failed to load case management details.",
        });
        return;
    }
    const internalNotes = toInternalNoteRows((notesResult.data ?? []));
    res.json({
        status: "ok",
        data: {
            case: mapCase(caseResult.data),
            tags: tagOptionsResult.data,
            internalNotes: internalNotes.map((note) => ({
                id: note.id,
                senderId: note.sender_id,
                senderRole: note.sender_role,
                messageText: note.message_text,
                createdAt: note.created_at,
            })),
        },
    });
});
router.patch("/employee/cases/:caseId", requireAuth_1.requireAuth, (0, requireRole_1.requireRole)("CSR"), async (req, res) => {
    const client = ensureSupabase();
    if (!client) {
        res.status(500).json({
            status: "error",
            message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee tree queries.",
        });
        return;
    }
    const viewer = req.user;
    if (!viewer) {
        res.status(401).json({
            status: "error",
            message: "Authentication is required.",
        });
        return;
    }
    const caseId = parseCaseIdParam(req.params.caseId);
    if ("error" in caseId) {
        res.status(400).json({
            status: "error",
            message: caseId.error,
        });
        return;
    }
    const parsedBody = (0, employeeTreeLogic_1.parseCasePatchBody)(req.body);
    if ("error" in parsedBody) {
        res.status(400).json({
            status: "error",
            message: parsedBody.error,
        });
        return;
    }
    const caseResult = await fetchCase(caseId.data);
    if ("error" in caseResult) {
        res.status(500).json({
            status: "error",
            message: caseResult.error,
        });
        return;
    }
    if (!caseResult.data) {
        res.status(404).json({
            status: "error",
            message: "Case not found.",
        });
        return;
    }
    if (caseResult.data.assigned_to !== viewer.sub) {
        res.status(403).json({
            status: "error",
            message: "You can only update cases assigned to your account.",
        });
        return;
    }
    const previousStatus = caseResult.data.status;
    const { data, error } = await client
        .from("cases")
        .update(parsedBody.data)
        .eq("id", caseId.data)
        .eq("assigned_to", viewer.sub)
        .select("id,customer_id,assigned_to,title,description,status,priority,customer_satisfaction_rating,created_at,updated_at")
        .maybeSingle();
    if (error) {
        res.status(400).json({
            status: "error",
            message: error.message,
        });
        return;
    }
    if (!data) {
        res.status(403).json({
            status: "error",
            message: "Case is no longer assigned to your account.",
        });
        return;
    }
    const parsedCase = toCaseRows([data])[0];
    if (!parsedCase) {
        res.status(500).json({
            status: "error",
            message: "Failed to parse updated case payload.",
        });
        return;
    }
    if (parsedCase.status !== previousStatus) {
        await client.from("messages").insert({
            case_id: parsedCase.id,
            sender_id: viewer.sub,
            sender_role: "CSR",
            message_type: "system",
            message_text: `Status updated to ${parsedCase.status}.`,
        });
    }
    res.json({
        status: "ok",
        data: mapCase(parsedCase),
    });
});
router.put("/employee/cases/:caseId/tags", requireAuth_1.requireAuth, (0, requireRole_1.requireRole)("CSR"), async (req, res) => {
    const client = ensureSupabase();
    if (!client) {
        res.status(500).json({
            status: "error",
            message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee tree queries.",
        });
        return;
    }
    const viewer = req.user;
    if (!viewer) {
        res.status(401).json({
            status: "error",
            message: "Authentication is required.",
        });
        return;
    }
    const caseId = parseCaseIdParam(req.params.caseId);
    if ("error" in caseId) {
        res.status(400).json({
            status: "error",
            message: caseId.error,
        });
        return;
    }
    const parsedBody = (0, employeeTreeLogic_1.parseTagUpdateBody)(req.body);
    if ("error" in parsedBody) {
        res.status(400).json({
            status: "error",
            message: parsedBody.error,
        });
        return;
    }
    const caseResult = await fetchCase(caseId.data);
    if ("error" in caseResult) {
        res.status(500).json({
            status: "error",
            message: caseResult.error,
        });
        return;
    }
    if (!caseResult.data) {
        res.status(404).json({
            status: "error",
            message: "Case not found.",
        });
        return;
    }
    if (caseResult.data.assigned_to !== viewer.sub) {
        res.status(403).json({
            status: "error",
            message: "You can only update tags for cases assigned to your account.",
        });
        return;
    }
    if (parsedBody.data.tagIds.length > 0) {
        const validTagResult = await client
            .from("tags")
            .select("id,name,color,affects_node_color")
            .in("id", parsedBody.data.tagIds)
            .order("name", { ascending: true });
        if (validTagResult.error) {
            res.status(400).json({
                status: "error",
                message: validTagResult.error.message,
            });
            return;
        }
        const matchedTagIds = new Set((validTagResult.data ?? []).map((tag) => String(tag.id)));
        const missingTagIds = parsedBody.data.tagIds.filter((tagId) => !matchedTagIds.has(tagId));
        if (missingTagIds.length > 0) {
            res.status(400).json({
                status: "error",
                message: `Unknown tag IDs: ${missingTagIds.join(", ")}`,
            });
            return;
        }
    }
    const customTagsResult = await resolveOrCreateCustomTags(client, parsedBody.data.customTagNames);
    if ("error" in customTagsResult) {
        res.status(400).json({
            status: "error",
            message: customTagsResult.error,
        });
        return;
    }
    const finalTagIds = Array.from(new Set([
        ...parsedBody.data.tagIds,
        ...customTagsResult.data.map((tag) => tag.id),
    ]));
    const deleteResult = await client.from("case_tags").delete().eq("case_id", caseId.data);
    if (deleteResult.error) {
        res.status(400).json({
            status: "error",
            message: deleteResult.error.message,
        });
        return;
    }
    if (finalTagIds.length > 0) {
        const insertResult = await client.from("case_tags").insert(finalTagIds.map((tagId) => ({
            case_id: caseId.data,
            tag_id: tagId,
        })));
        if (insertResult.error) {
            res.status(400).json({
                status: "error",
                message: insertResult.error.message,
            });
            return;
        }
    }
    const tagOptionsResult = await loadCaseTagOptions(client, caseId.data);
    if ("error" in tagOptionsResult) {
        res.status(500).json({
            status: "error",
            message: tagOptionsResult.error,
        });
        return;
    }
    res.json({
        status: "ok",
        data: {
            tags: tagOptionsResult.data,
        },
    });
});
router.post("/employee/cases/:caseId/notes", requireAuth_1.requireAuth, (0, requireRole_1.requireRole)("CSR"), async (req, res) => {
    const client = ensureSupabase();
    if (!client) {
        res.status(500).json({
            status: "error",
            message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee tree queries.",
        });
        return;
    }
    const viewer = req.user;
    if (!viewer) {
        res.status(401).json({
            status: "error",
            message: "Authentication is required.",
        });
        return;
    }
    const caseId = parseCaseIdParam(req.params.caseId);
    if ("error" in caseId) {
        res.status(400).json({
            status: "error",
            message: caseId.error,
        });
        return;
    }
    const parsedBody = parseInternalNoteCreateBody(req.body);
    if ("error" in parsedBody) {
        res.status(400).json({
            status: "error",
            message: parsedBody.error,
        });
        return;
    }
    const caseResult = await fetchCase(caseId.data);
    if ("error" in caseResult) {
        res.status(500).json({
            status: "error",
            message: caseResult.error,
        });
        return;
    }
    if (!caseResult.data) {
        res.status(404).json({
            status: "error",
            message: "Case not found.",
        });
        return;
    }
    if (caseResult.data.assigned_to !== viewer.sub) {
        res.status(403).json({
            status: "error",
            message: "You can only add notes to cases assigned to your account.",
        });
        return;
    }
    const insertResult = await client
        .from("messages")
        .insert({
        case_id: caseId.data,
        sender_id: viewer.sub,
        sender_role: "CSR",
        message_type: "internal_note",
        message_text: parsedBody.data.messageText,
    })
        .select("id,sender_id,sender_role,message_text,created_at")
        .single();
    if (insertResult.error) {
        res.status(400).json({
            status: "error",
            message: insertResult.error.message,
        });
        return;
    }
    const note = toInternalNoteRows([insertResult.data])[0];
    if (!note) {
        res.status(500).json({
            status: "error",
            message: "Failed to parse created internal note payload.",
        });
        return;
    }
    res.status(201).json({
        status: "ok",
        data: {
            id: note.id,
            senderId: note.sender_id,
            senderRole: note.sender_role,
            messageText: note.message_text,
            createdAt: note.created_at,
        },
    });
});
router.get("/employee/cases/:caseId/workflow", requireAuth_1.requireAuth, (0, requireRole_1.requireRole)("CSR", "Manager", "Executive", "Admin"), async (req, res) => {
    const client = ensureSupabase();
    if (!client) {
        res.status(500).json({
            status: "error",
            message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee workflow queries.",
        });
        return;
    }
    const viewer = req.user;
    if (!viewer) {
        res.status(401).json({
            status: "error",
            message: "Authentication is required.",
        });
        return;
    }
    const caseId = parseCaseIdParam(req.params.caseId);
    if ("error" in caseId) {
        res.status(400).json({
            status: "error",
            message: caseId.error,
        });
        return;
    }
    const caseResult = await fetchCase(caseId.data);
    if ("error" in caseResult) {
        res.status(500).json({
            status: "error",
            message: caseResult.error,
        });
        return;
    }
    if (!caseResult.data) {
        res.status(404).json({
            status: "error",
            message: "Case not found.",
        });
        return;
    }
    if (!(0, employeeTreeLogic_1.canAccessCase)(viewer, caseResult.data)) {
        res.status(403).json({
            status: "error",
            message: "You are not allowed to view workflow details for this case.",
        });
        return;
    }
    const endorsementsResult = await client
        .from("endorsements")
        .select("id,case_id,endorsed_by,endorsed_to,status,created_at")
        .eq("case_id", caseId.data)
        .order("created_at", { ascending: false });
    if (endorsementsResult.error) {
        res.status(500).json({
            status: "error",
            message: endorsementsResult.error.message,
        });
        return;
    }
    const endorsements = toEndorsementRows((endorsementsResult.data ?? []));
    const workflowUserIds = endorsements.flatMap((endorsement) => [
        endorsement.endorsed_by,
        endorsement.endorsed_to,
    ]);
    if (caseResult.data.assigned_to) {
        workflowUserIds.push(caseResult.data.assigned_to);
    }
    const usersResult = await fetchUsersMapByIds(client, workflowUserIds);
    if ("error" in usersResult) {
        res.status(500).json({
            status: "error",
            message: usersResult.error,
        });
        return;
    }
    const usersById = usersResult.data;
    const mappedEndorsements = endorsements
        .map((endorsement) => mapEndorsementForResponse(endorsement, usersById, viewer.sub))
        .filter((endorsement) => endorsement !== null);
    let endorsementTargets = [];
    if (viewer.role === "CSR") {
        const targetUsersResult = await client
            .from("users")
            .select("id,email,name,role,created_at")
            .in("role", ENDORSEMENT_TARGET_ROLES)
            .order("role", { ascending: true })
            .order("name", { ascending: true });
        if (targetUsersResult.error) {
            res.status(500).json({
                status: "error",
                message: targetUsersResult.error.message,
            });
            return;
        }
        endorsementTargets = toUserRows((targetUsersResult.data ?? [])).map(toWorkflowUser);
    }
    let reassignmentCandidates = [];
    if (CASE_REASSIGN_ROLES.includes(viewer.role)) {
        const candidateResult = await client
            .from("users")
            .select("id,email,name,role,created_at")
            .eq("role", "CSR")
            .order("name", { ascending: true });
        if (candidateResult.error) {
            res.status(500).json({
                status: "error",
                message: candidateResult.error.message,
            });
            return;
        }
        reassignmentCandidates = toUserRows((candidateResult.data ?? [])).map(toWorkflowUser);
    }
    const pendingEndorsementCount = endorsements.filter((endorsement) => endorsement.status === "Pending").length;
    const assignedTo = caseResult.data.assigned_to ? usersById.get(caseResult.data.assigned_to) ?? null : null;
    res.json({
        status: "ok",
        data: {
            case: {
                ...mapCase(caseResult.data, {
                    hasPendingEndorsement: pendingEndorsementCount > 0,
                    pendingEndorsementCount,
                }),
                assignedToUser: assignedTo ? toWorkflowUser(assignedTo) : null,
            },
            endorsements: mappedEndorsements,
            endorsementTargets,
            reassignmentCandidates,
        },
    });
});
router.post("/employee/cases/:caseId/endorsements", requireAuth_1.requireAuth, (0, requireRole_1.requireRole)("CSR"), async (req, res) => {
    const client = ensureSupabase();
    if (!client) {
        res.status(500).json({
            status: "error",
            message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee workflow queries.",
        });
        return;
    }
    const viewer = req.user;
    if (!viewer) {
        res.status(401).json({
            status: "error",
            message: "Authentication is required.",
        });
        return;
    }
    const caseId = parseCaseIdParam(req.params.caseId);
    if ("error" in caseId) {
        res.status(400).json({
            status: "error",
            message: caseId.error,
        });
        return;
    }
    const parsedBody = (0, employeeTreeLogic_1.parseEndorseCaseBody)(req.body);
    if ("error" in parsedBody) {
        res.status(400).json({
            status: "error",
            message: parsedBody.error,
        });
        return;
    }
    const caseResult = await fetchCase(caseId.data);
    if ("error" in caseResult) {
        res.status(500).json({
            status: "error",
            message: caseResult.error,
        });
        return;
    }
    if (!caseResult.data) {
        res.status(404).json({
            status: "error",
            message: "Case not found.",
        });
        return;
    }
    if (caseResult.data.assigned_to !== viewer.sub) {
        res.status(403).json({
            status: "error",
            message: "You can only endorse cases assigned to your account.",
        });
        return;
    }
    const endorsedToUserResult = await client
        .from("users")
        .select("id,email,name,role,created_at")
        .eq("id", parsedBody.data.endorsedToId)
        .maybeSingle();
    if (endorsedToUserResult.error) {
        res.status(500).json({
            status: "error",
            message: endorsedToUserResult.error.message,
        });
        return;
    }
    const endorsedToUser = endorsedToUserResult.data
        ? toUserRows([endorsedToUserResult.data])[0]
        : null;
    if (!endorsedToUser || !ENDORSEMENT_TARGET_ROLES.includes(endorsedToUser.role)) {
        res.status(400).json({
            status: "error",
            message: "endorsedToId must reference a Manager or Executive account.",
        });
        return;
    }
    const existingPendingResult = await client
        .from("endorsements")
        .select("id")
        .eq("case_id", caseResult.data.id)
        .eq("status", "Pending")
        .limit(1);
    if (existingPendingResult.error) {
        res.status(500).json({
            status: "error",
            message: existingPendingResult.error.message,
        });
        return;
    }
    if ((existingPendingResult.data ?? []).length > 0) {
        res.status(409).json({
            status: "error",
            message: "This case already has a pending endorsement.",
        });
        return;
    }
    const insertResult = await client
        .from("endorsements")
        .insert({
        case_id: caseResult.data.id,
        endorsed_by: viewer.sub,
        endorsed_to: endorsedToUser.id,
        status: "Pending",
    })
        .select("id,case_id,endorsed_by,endorsed_to,status,created_at")
        .single();
    if (insertResult.error) {
        res.status(400).json({
            status: "error",
            message: insertResult.error.message,
        });
        return;
    }
    const endorsement = toEndorsementRows([insertResult.data])[0];
    if (!endorsement) {
        res.status(500).json({
            status: "error",
            message: "Failed to parse created endorsement payload.",
        });
        return;
    }
    const viewerDisplayName = getDisplayName({ name: viewer.name, email: viewer.email });
    const endorsedToName = getDisplayName({ name: endorsedToUser.name, email: endorsedToUser.email });
    await client.from("messages").insert({
        case_id: caseResult.data.id,
        sender_id: viewer.sub,
        sender_role: "CSR",
        message_type: "system",
        message_text: `Case endorsed to ${endorsedToName} (${endorsedToUser.role}).`,
    });
    await (0, notificationService_1.createNotification)({
        userId: endorsedToUser.id,
        type: "case_endorsement",
        message: `${viewerDisplayName} endorsed "${caseResult.data.title}" to you.`,
    });
    res.status(201).json({
        status: "ok",
        data: {
            endorsement: {
                id: endorsement.id,
                caseId: endorsement.case_id,
                status: endorsement.status,
                createdAt: endorsement.created_at,
                endorsedBy: {
                    id: viewer.sub,
                    name: viewer.name ?? null,
                    email: viewer.email,
                    role: viewer.role,
                },
                endorsedTo: toWorkflowUser(endorsedToUser),
                isPendingForViewer: false,
            },
        },
    });
});
router.patch("/employee/endorsements/:endorsementId", requireAuth_1.requireAuth, (0, requireRole_1.requireRole)("Manager", "Executive", "Admin"), async (req, res) => {
    const client = ensureSupabase();
    if (!client) {
        res.status(500).json({
            status: "error",
            message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee workflow queries.",
        });
        return;
    }
    const viewer = req.user;
    if (!viewer) {
        res.status(401).json({
            status: "error",
            message: "Authentication is required.",
        });
        return;
    }
    const endorsementId = parseEndorsementIdParam(req.params.endorsementId);
    if ("error" in endorsementId) {
        res.status(400).json({
            status: "error",
            message: endorsementId.error,
        });
        return;
    }
    const parsedBody = (0, employeeTreeLogic_1.parseEndorsementDecisionBody)(req.body);
    if ("error" in parsedBody) {
        res.status(400).json({
            status: "error",
            message: parsedBody.error,
        });
        return;
    }
    const endorsementResult = await client
        .from("endorsements")
        .select("id,case_id,endorsed_by,endorsed_to,status,created_at")
        .eq("id", endorsementId.data)
        .maybeSingle();
    if (endorsementResult.error) {
        res.status(500).json({
            status: "error",
            message: endorsementResult.error.message,
        });
        return;
    }
    const endorsement = endorsementResult.data ? toEndorsementRows([endorsementResult.data])[0] : null;
    if (!endorsement) {
        res.status(404).json({
            status: "error",
            message: "Endorsement not found.",
        });
        return;
    }
    if (endorsement.status !== "Pending") {
        res.status(409).json({
            status: "error",
            message: "Only pending escalation requests can be approved or rejected.",
        });
        return;
    }
    if (viewer.role !== "Admin" && endorsement.endorsed_to !== viewer.sub) {
        res.status(403).json({
            status: "error",
            message: "You can only act on endorsements assigned to your account.",
        });
        return;
    }
    const caseResult = await fetchCase(endorsement.case_id);
    if ("error" in caseResult) {
        res.status(500).json({
            status: "error",
            message: caseResult.error,
        });
        return;
    }
    if (!caseResult.data) {
        res.status(404).json({
            status: "error",
            message: "Case for this endorsement no longer exists.",
        });
        return;
    }
    const updateResult = await client
        .from("endorsements")
        .update({ status: parsedBody.data.status })
        .eq("id", endorsement.id)
        .eq("status", "Pending")
        .select("id,case_id,endorsed_by,endorsed_to,status,created_at")
        .maybeSingle();
    if (updateResult.error) {
        res.status(400).json({
            status: "error",
            message: updateResult.error.message,
        });
        return;
    }
    const updatedEndorsement = updateResult.data ? toEndorsementRows([updateResult.data])[0] : null;
    if (!updatedEndorsement) {
        res.status(409).json({
            status: "error",
            message: "Endorsement is no longer pending.",
        });
        return;
    }
    const usersResult = await fetchUsersMapByIds(client, [
        updatedEndorsement.endorsed_by,
        updatedEndorsement.endorsed_to,
        ...(caseResult.data.assigned_to ? [caseResult.data.assigned_to] : []),
    ]);
    if ("error" in usersResult) {
        res.status(500).json({
            status: "error",
            message: usersResult.error,
        });
        return;
    }
    const usersById = usersResult.data;
    const viewerDisplayName = getDisplayName({ name: viewer.name, email: viewer.email });
    await client.from("messages").insert({
        case_id: caseResult.data.id,
        sender_id: viewer.sub,
        sender_role: viewer.role,
        message_type: "system",
        message_text: `Escalation request ${parsedBody.data.status.toLowerCase()} by ${viewerDisplayName}. Assignment unchanged unless manually reassigned.`,
    });
    if (updatedEndorsement.endorsed_by !== viewer.sub) {
        await (0, notificationService_1.createNotification)({
            userId: updatedEndorsement.endorsed_by,
            type: "case_endorsement_decision",
            message: `Your escalation request on "${caseResult.data.title}" was ${parsedBody.data.status.toLowerCase()} by ${viewerDisplayName}. Assignment is unchanged.`,
        });
    }
    if (caseResult.data.assigned_to &&
        caseResult.data.assigned_to !== viewer.sub &&
        caseResult.data.assigned_to !== updatedEndorsement.endorsed_by) {
        await (0, notificationService_1.createNotification)({
            userId: caseResult.data.assigned_to,
            type: "case_endorsement_decision",
            message: `An escalation request on "${caseResult.data.title}" was ${parsedBody.data.status.toLowerCase()}. Assignment is unchanged.`,
        });
    }
    const mapped = mapEndorsementForResponse(updatedEndorsement, usersById, viewer.sub);
    if (!mapped) {
        res.status(500).json({
            status: "error",
            message: "Failed to build endorsement response payload.",
        });
        return;
    }
    res.json({
        status: "ok",
        data: {
            endorsement: mapped,
            caseAssignmentChanged: false,
        },
    });
});
router.patch("/employee/cases/:caseId/reassign", requireAuth_1.requireAuth, (0, requireRole_1.requireRole)("Manager", "Executive", "Admin"), async (req, res) => {
    const client = ensureSupabase();
    if (!client) {
        res.status(500).json({
            status: "error",
            message: "SUPABASE_SERVICE_ROLE_KEY is required in backend/.env for employee workflow queries.",
        });
        return;
    }
    const viewer = req.user;
    if (!viewer) {
        res.status(401).json({
            status: "error",
            message: "Authentication is required.",
        });
        return;
    }
    const caseId = parseCaseIdParam(req.params.caseId);
    if ("error" in caseId) {
        res.status(400).json({
            status: "error",
            message: caseId.error,
        });
        return;
    }
    const parsedBody = (0, employeeTreeLogic_1.parseCaseReassignBody)(req.body);
    if ("error" in parsedBody) {
        res.status(400).json({
            status: "error",
            message: parsedBody.error,
        });
        return;
    }
    if (!CASE_REASSIGN_ROLES.includes(viewer.role)) {
        res.status(403).json({
            status: "error",
            message: "Your role is not allowed to reassign cases.",
        });
        return;
    }
    const caseResult = await fetchCase(caseId.data);
    if ("error" in caseResult) {
        res.status(500).json({
            status: "error",
            message: caseResult.error,
        });
        return;
    }
    if (!caseResult.data) {
        res.status(404).json({
            status: "error",
            message: "Case not found.",
        });
        return;
    }
    const previousAssigneeId = caseResult.data.assigned_to;
    if (!previousAssigneeId) {
        res.status(400).json({
            status: "error",
            message: "Case is not currently assigned to any CSR.",
        });
        return;
    }
    if (previousAssigneeId === parsedBody.data.assigneeId) {
        res.status(400).json({
            status: "error",
            message: "assigneeId must be different from the current assignee.",
        });
        return;
    }
    const usersResult = await fetchUsersMapByIds(client, [previousAssigneeId, parsedBody.data.assigneeId]);
    if ("error" in usersResult) {
        res.status(500).json({
            status: "error",
            message: usersResult.error,
        });
        return;
    }
    const usersById = usersResult.data;
    const previousAssignee = usersById.get(previousAssigneeId) ?? null;
    const nextAssignee = usersById.get(parsedBody.data.assigneeId) ?? null;
    if (!nextAssignee || nextAssignee.role !== "CSR") {
        res.status(400).json({
            status: "error",
            message: "assigneeId must reference a CSR account.",
        });
        return;
    }
    const updateCaseResult = await client
        .from("cases")
        .update({ assigned_to: nextAssignee.id })
        .eq("id", caseResult.data.id)
        .select("id,customer_id,assigned_to,title,description,status,priority,customer_satisfaction_rating,created_at,updated_at")
        .maybeSingle();
    if (updateCaseResult.error) {
        res.status(400).json({
            status: "error",
            message: updateCaseResult.error.message,
        });
        return;
    }
    const updatedCase = updateCaseResult.data ? toCaseRows([updateCaseResult.data])[0] : null;
    if (!updatedCase) {
        res.status(500).json({
            status: "error",
            message: "Failed to parse reassigned case payload.",
        });
        return;
    }
    const cancelledEndorsementsResult = await client
        .from("endorsements")
        .update({ status: "Cancelled" })
        .eq("case_id", updatedCase.id)
        .eq("status", "Pending")
        .select("id,case_id,endorsed_by,endorsed_to,status,created_at");
    if (cancelledEndorsementsResult.error) {
        res.status(400).json({
            status: "error",
            message: cancelledEndorsementsResult.error.message,
        });
        return;
    }
    const cancelledEndorsements = toEndorsementRows((cancelledEndorsementsResult.data ?? []));
    const actorName = getDisplayName({ name: viewer.name, email: viewer.email });
    const previousAssigneeName = previousAssignee
        ? getDisplayName({ name: previousAssignee.name, email: previousAssignee.email })
        : "Unassigned";
    const nextAssigneeName = getDisplayName({ name: nextAssignee.name, email: nextAssignee.email });
    const reasonSuffix = parsedBody.data.reason ? ` Reason: ${parsedBody.data.reason}` : "";
    await client.from("messages").insert({
        case_id: updatedCase.id,
        sender_id: viewer.sub,
        sender_role: viewer.role,
        message_type: "system",
        message_text: `Case reassigned from ${previousAssigneeName} to ${nextAssigneeName} by ${actorName}.${reasonSuffix}`,
    });
    if (previousAssigneeId !== viewer.sub) {
        await (0, notificationService_1.createNotification)({
            userId: previousAssigneeId,
            type: "case_reassignment",
            message: `"${updatedCase.title}" was reassigned from you to ${nextAssigneeName} by ${actorName}.`,
        });
    }
    if (nextAssignee.id !== viewer.sub) {
        await (0, notificationService_1.createNotification)({
            userId: nextAssignee.id,
            type: "case_reassignment",
            message: `"${updatedCase.title}" was reassigned to you by ${actorName}.`,
        });
    }
    const cancelledRecipientIds = Array.from(new Set(cancelledEndorsements
        .flatMap((endorsement) => [endorsement.endorsed_by, endorsement.endorsed_to])
        .filter((userId) => userId !== viewer.sub)));
    await Promise.all(cancelledRecipientIds.map((userId) => (0, notificationService_1.createNotification)({
        userId,
        type: "case_endorsement_cancelled",
        message: `Pending endorsements for "${updatedCase.title}" were cancelled after reassignment.`,
    })));
    res.json({
        status: "ok",
        data: {
            case: {
                ...mapCase(updatedCase),
                assignedToUser: toWorkflowUser(nextAssignee),
            },
            previousAssignee: previousAssignee ? toWorkflowUser(previousAssignee) : null,
            newAssignee: toWorkflowUser(nextAssignee),
            cancelledEndorsementCount: cancelledEndorsements.length,
        },
    });
});
exports.employeeTreeRouter = router;
