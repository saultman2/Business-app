import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clientsRouter from "./clients";
import jobsRouter from "./jobs";
import estimatesRouter from "./estimates";
import materialsRouter from "./materials";
import photosRouter from "./photos";
import receiptsRouter from "./receipts";
import eventsRouter from "./events";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(clientsRouter);
router.use(jobsRouter);
router.use(estimatesRouter);
router.use(materialsRouter);
router.use(photosRouter);
router.use(receiptsRouter);
router.use(eventsRouter);

export default router;
