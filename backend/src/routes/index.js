const createAuthRoutes = require("./auth");
const createTransactionRoutes = require("./transactions");
const createAlertRoutes = require("./alerts");
const createGraphRoutes = require("./graph");
const createCaseRoutes = require("./cases");
const createAdminRoutes = require("./admin");

module.exports = {
    createAuthRoutes,
    createTransactionRoutes,
    createAlertRoutes,
    createGraphRoutes,
    createCaseRoutes,
    createAdminRoutes,
};
