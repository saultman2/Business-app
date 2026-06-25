import { Router, type IRouter } from "express";
import healthRouter from "./health";
import companyRouter from "./company";
import clientsRouter from "./clients";
import jobsRouter from "./jobs";
import materialsRouter from "./materials";
import estimatesRouter from "./estimates";
import invoicesRouter from "./invoices";
import photosRouter from "./photos";
import receiptsRouter from "./receipts";
import eventsRouter from "./events";
import dashboardRouter from "./dashboard";
import storageRouter from "./storage";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(companyRouter);
router.use(clientsRouter);
router.use(jobsRouter);
router.use(materialsRouter);
router.use(estimatesRouter);
router.use(invoicesRouter);
router.use(photosRouter);
router.use(receiptsRouter);
router.use(eventsRouter);
router.use(storageRouter);
router.use(aiRouter);

export default router;
