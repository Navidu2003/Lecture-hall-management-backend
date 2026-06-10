export function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== "ADMIN") {
        return res.status(403).json({ message: "Admin access required" });
    }
    next();
}

export function requireHOD(req, res, next) {
    if (!req.user || req.user.role !== "HOD") {
        return res.status(403).json({ message: "HOD access required" });
    }
    next();
}

export function requireLecturer(req, res, next) {
    if (!req.user || req.user.role !== "LECTURER") {
        return res.status(403).json({ message: "Lecturer access required" });
    }
    next();
}

export function requireLecturerOrHOD(req, res, next) {
    if (!req.user || 
       (req.user.role !== "LECTURER" && req.user.role !== "HOD")) {
        return res.status(403).json({ message: "Access denied" });
    }
    next();
}

export function requireTO(req, res, next) {
    if (!req.user || req.user.role !== "TO") {
        return res.status(403).json({ message: "TO access required" });
    }
    next();
}