"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRecord = isRecord;
exports.isUuid = isUuid;
exports.getStartOfUtcDayEpoch = getStartOfUtcDayEpoch;
exports.buildPerformanceMetrics = buildPerformanceMetrics;
exports.aggregatePerformanceMetrics = aggregatePerformanceMetrics;
exports.buildManagerCsrAssignments = buildManagerCsrAssignments;
exports.parseCasePatchBody = parseCasePatchBody;
exports.normalizeTagName = normalizeTagName;
exports.parseTagUpdateBody = parseTagUpdateBody;
exports.parseEndorseCaseBody = parseEndorseCaseBody;
exports.parseEndorsementDecisionBody = parseEndorsementDecisionBody;
exports.parseCaseReassignBody = parseCaseReassignBody;
exports.canAccessCase = canAccessCase;
const STATUS_VALUES = ["Open", "In Progress", "Resolved", "Dropped"];
const PRIORITY_VALUES = ["High", "Medium", "Low"];
const ENDORSEMENT_DECISION_VALUES = ["Accepted", "Rejected"];
const ONGOING_CASE_STATUSES = ["Open", "In Progress"];
const CUSTOM_TAG_NAME_MIN_LENGTH = 2;
const CUSTOM_TAG_NAME_MAX_LENGTH = 40;
const CUSTOM_TAG_REQUEST_LIMIT = 10;
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function roundToSingleDecimal(value) {
    return Math.round(value * 10) / 10;
}
function getUserSortLabel(user) {
    return (user.name ?? user.email).trim().toLowerCase();
}
function readEnum(value, fieldName, allowedValues) {
    if (typeof value !== "string" || !allowedValues.includes(value)) {
        return { error: `${fieldName} must be one of: ${allowedValues.join(", ")}.` };
    }
    return { data: value };
}
function getStartOfUtcDayEpoch(now = new Date()) {
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
}
function buildPerformanceMetrics(caseItems, resolvedTodayThresholdEpoch) {
    let ongoingCases = 0;
    let resolvedToday = 0;
    let resolvedCases = 0;
    let droppedCases = 0;
    let ratedCaseCount = 0;
    let ratingTotal = 0;
    for (const caseItem of caseItems) {
        if (typeof caseItem.customer_satisfaction_rating === "number") {
            ratedCaseCount += 1;
            ratingTotal += caseItem.customer_satisfaction_rating;
        }
        if (ONGOING_CASE_STATUSES.includes(caseItem.status)) {
            ongoingCases += 1;
        }
        if (caseItem.status === "Resolved") {
            resolvedCases += 1;
            const updatedEpoch = Date.parse(caseItem.updated_at);
            if (!Number.isNaN(updatedEpoch) && updatedEpoch >= resolvedTodayThresholdEpoch) {
                resolvedToday += 1;
            }
            continue;
        }
        if (caseItem.status === "Dropped") {
            droppedCases += 1;
        }
    }
    const completedCases = resolvedCases + droppedCases;
    return {
        ongoingCases,
        resolvedToday,
        customerSatisfaction: ratedCaseCount > 0 ? roundToSingleDecimal((ratingTotal / (ratedCaseCount * 5)) * 100) : null,
        totalCases: caseItems.length,
        resolvedCases,
        droppedCases,
        completedCases,
        ratedCaseCount,
        ratingTotal,
    };
}
function aggregatePerformanceMetrics(metricRows) {
    const totals = metricRows.reduce((accumulator, metrics) => {
        accumulator.ongoingCases += metrics.ongoingCases;
        accumulator.resolvedToday += metrics.resolvedToday;
        accumulator.totalCases += metrics.totalCases;
        accumulator.resolvedCases += metrics.resolvedCases;
        accumulator.droppedCases += metrics.droppedCases;
        accumulator.completedCases += metrics.completedCases;
        accumulator.ratedCaseCount += metrics.ratedCaseCount;
        accumulator.ratingTotal += metrics.ratingTotal;
        return accumulator;
    }, {
        ongoingCases: 0,
        resolvedToday: 0,
        totalCases: 0,
        resolvedCases: 0,
        droppedCases: 0,
        completedCases: 0,
        ratedCaseCount: 0,
        ratingTotal: 0,
    });
    return {
        ...totals,
        customerSatisfaction: totals.ratedCaseCount > 0
            ? roundToSingleDecimal((totals.ratingTotal / (totals.ratedCaseCount * 5)) * 100)
            : null,
    };
}
function buildManagerCsrAssignments(managers, csrs, csrMetricsById) {
    const managerIds = new Set(managers.map((manager) => manager.id));
    const csrIdsByManagerId = new Map(managers.map((manager) => [manager.id, []]));
    const unassignedCsrIds = [];
    for (const csr of csrs) {
        if (csr.manager_id && managerIds.has(csr.manager_id)) {
            const current = csrIdsByManagerId.get(csr.manager_id) ?? [];
            current.push(csr.id);
            csrIdsByManagerId.set(csr.manager_id, current);
            continue;
        }
        unassignedCsrIds.push(csr.id);
    }
    const hasExplicitAssignments = Array.from(csrIdsByManagerId.values()).some((ids) => ids.length > 0);
    if (hasExplicitAssignments) {
        return {
            mode: "manager_assignment",
            csrIdsByManagerId,
            unassignedCsrIds,
        };
    }
    if (managers.length === 0 || unassignedCsrIds.length === 0) {
        return {
            mode: "none",
            csrIdsByManagerId,
            unassignedCsrIds,
        };
    }
    const managerWorkloads = managers
        .slice()
        .sort((a, b) => getUserSortLabel(a).localeCompare(getUserSortLabel(b)))
        .map((manager) => ({
        managerId: manager.id,
        caseLoad: 0,
    }));
    const fallbackCsrIds = unassignedCsrIds
        .slice()
        .sort((leftId, rightId) => {
        const leftLoad = csrMetricsById.get(leftId)?.totalCases ?? 0;
        const rightLoad = csrMetricsById.get(rightId)?.totalCases ?? 0;
        return rightLoad - leftLoad;
    });
    for (const csrId of fallbackCsrIds) {
        managerWorkloads.sort((a, b) => {
            if (a.caseLoad !== b.caseLoad) {
                return a.caseLoad - b.caseLoad;
            }
            return a.managerId.localeCompare(b.managerId);
        });
        const [targetManager] = managerWorkloads;
        if (!targetManager) {
            break;
        }
        const current = csrIdsByManagerId.get(targetManager.managerId) ?? [];
        current.push(csrId);
        csrIdsByManagerId.set(targetManager.managerId, current);
        targetManager.caseLoad += csrMetricsById.get(csrId)?.totalCases ?? 0;
    }
    return {
        mode: "derived_balanced_fallback",
        csrIdsByManagerId,
        unassignedCsrIds: [],
    };
}
function parseCasePatchBody(body) {
    if (!isRecord(body)) {
        return { error: "Request body must be a JSON object." };
    }
    const hasStatus = Object.hasOwn(body, "status");
    const hasPriority = Object.hasOwn(body, "priority");
    if (!hasStatus && !hasPriority) {
        return { error: "Provide at least one of: status, priority." };
    }
    const parsed = {};
    if (hasStatus) {
        const status = readEnum(body.status, "status", STATUS_VALUES);
        if ("error" in status) {
            return status;
        }
        parsed.status = status.data;
    }
    if (hasPriority) {
        const priority = readEnum(body.priority, "priority", PRIORITY_VALUES);
        if ("error" in priority) {
            return priority;
        }
        parsed.priority = priority.data;
    }
    return { data: parsed };
}
function normalizeTagName(value) {
    return value.trim().replace(/\s+/g, " ");
}
function parseTagUpdateBody(body) {
    if (!isRecord(body)) {
        return { error: "Request body must be a JSON object." };
    }
    const tagIds = body.tagIds;
    if (!Array.isArray(tagIds)) {
        return { error: "tagIds must be an array of UUID strings." };
    }
    const deduped = Array.from(new Set(tagIds));
    if (!deduped.every((value) => typeof value === "string" && isUuid(value))) {
        return { error: "All tagIds must be valid UUID strings." };
    }
    const rawCustomTagNames = typeof body.customTagNames === "undefined" ? [] : body.customTagNames;
    if (!Array.isArray(rawCustomTagNames)) {
        return { error: "customTagNames must be an array of tag names when provided." };
    }
    if (rawCustomTagNames.length > CUSTOM_TAG_REQUEST_LIMIT) {
        return {
            error: `customTagNames cannot contain more than ${CUSTOM_TAG_REQUEST_LIMIT} entries.`,
        };
    }
    const normalizedCustomTagNames = new Map();
    for (const rawValue of rawCustomTagNames) {
        if (typeof rawValue !== "string") {
            return { error: "customTagNames must contain only strings." };
        }
        const normalizedName = normalizeTagName(rawValue);
        if (normalizedName.length < CUSTOM_TAG_NAME_MIN_LENGTH || normalizedName.length > CUSTOM_TAG_NAME_MAX_LENGTH) {
            return {
                error: `Each custom tag name must be ${CUSTOM_TAG_NAME_MIN_LENGTH}-${CUSTOM_TAG_NAME_MAX_LENGTH} characters after trimming.`,
            };
        }
        const normalizedKey = normalizedName.toLowerCase();
        if (!normalizedCustomTagNames.has(normalizedKey)) {
            normalizedCustomTagNames.set(normalizedKey, normalizedName);
        }
    }
    return {
        data: {
            tagIds: deduped,
            customTagNames: Array.from(normalizedCustomTagNames.values()),
        },
    };
}
function parseEndorseCaseBody(body) {
    if (!isRecord(body)) {
        return { error: "Request body must be a JSON object." };
    }
    if (typeof body.endorsedToId !== "string" || !isUuid(body.endorsedToId)) {
        return { error: "endorsedToId must be a valid UUID." };
    }
    return { data: { endorsedToId: body.endorsedToId } };
}
function parseEndorsementDecisionBody(body) {
    if (!isRecord(body)) {
        return { error: "Request body must be a JSON object." };
    }
    const status = readEnum(body.status, "status", ENDORSEMENT_DECISION_VALUES);
    if ("error" in status) {
        return status;
    }
    return { data: { status: status.data } };
}
function parseCaseReassignBody(body) {
    if (!isRecord(body)) {
        return { error: "Request body must be a JSON object." };
    }
    if (typeof body.assigneeId !== "string" || !isUuid(body.assigneeId)) {
        return { error: "assigneeId must be a valid UUID." };
    }
    if (typeof body.reason === "undefined" || body.reason === null) {
        return { data: { assigneeId: body.assigneeId } };
    }
    if (typeof body.reason !== "string") {
        return { error: "reason must be a string when provided." };
    }
    const normalizedReason = body.reason.trim();
    if (normalizedReason.length > 400) {
        return { error: "reason must be at most 400 characters." };
    }
    return {
        data: {
            assigneeId: body.assigneeId,
            ...(normalizedReason ? { reason: normalizedReason } : {}),
        },
    };
}
function canAccessCase(viewer, caseItem) {
    if (viewer.role === "CSR") {
        return caseItem.assigned_to === viewer.sub;
    }
    return true;
}
