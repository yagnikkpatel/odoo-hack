import { Router } from "express";
import { adminRouter } from "./admin.routes";
import { authRouter } from "./auth.routes";
import { contractRouter } from "./contract.routes";
import { employeeRouter } from "./employee.routes";
import { healthRouter } from "./health.routes";
import { orgRouter } from "./org.routes";
import { scheduleRouter } from "./schedule.routes";

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(authRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use(orgRouter);
apiRouter.use("/employees", employeeRouter);
apiRouter.use("/working-schedules", scheduleRouter);
apiRouter.use("/contracts", contractRouter);
