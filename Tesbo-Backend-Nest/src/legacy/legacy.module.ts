import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LegacyController } from "./legacy.controller";
import { LegacyService } from "./legacy.service";

@Module({
  imports: [AuthModule],
  controllers: [LegacyController],
  providers: [LegacyService]
})
export class LegacyModule {}
