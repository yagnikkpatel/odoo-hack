import { Router } from "express";
import { healthRouter } from "./health.routes";
import { authRouter } from "./auth.routes";
import { userRouter } from "./user.routes";
import { employeeRouter } from "./employee.routes";
import { contractRouter } from "./contract.routes";
import { attendanceRouter } from "./attendance.routes";
<<<<<<< Updated upstream
import { timeOffRouter } from "./timeOff.routes";
=======
import { timeOffRouter } from "./time-off.routes";
>>>>>>> Stashed changes

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/employees", employeeRouter);
apiRouter.use("/contracts", contractRouter);
apiRouter.use("/attendance", attendanceRouter);
apiRouter.use("/time-off", timeOffRouter);
