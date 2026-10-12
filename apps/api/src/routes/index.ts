import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import staffRoutes from "../modules/staff/staff.routes.js";
import shiftRoutes from "../modules/shifts/shifts.routes.js";
import settingsRoutes from "../modules/settings/settings.routes.js";
import catalogRoutes from "../modules/catalog/catalog.routes.js";
import inventoryRoutes from "../modules/inventory/inventory.routes.js";
import orderRoutes from "../modules/orders/orders.routes.js";
import templateRoutes from "../modules/templates/templates.routes.js";
import deviceRoutes from "../modules/devices/devices.routes.js";
import paymentRoutes from "../modules/payments/payments.routes.js";
import publicRoutes from "../modules/public/public.routes.js";
import reportRoutes from "../modules/reports/reports.routes.js";
import pairingRoutes from "../modules/pairing/pairing.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/staff", staffRoutes);
router.use("/shifts", shiftRoutes);
router.use("/settings", settingsRoutes);
router.use("/catalog", catalogRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/orders", orderRoutes);
router.use("/templates", templateRoutes);
router.use("/devices", deviceRoutes);
router.use("/payments", paymentRoutes);
router.use("/reports", reportRoutes);
router.use("/pairing", pairingRoutes);
router.use("/public", publicRoutes);

export default router;
