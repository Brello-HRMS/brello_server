import { Controller, UseGuards } from "@nestjs/common";
import { AccessGuard } from "src/core/guards/access.guard";
import { JwtAuthGuard } from "src/modules/auth/guards/jwt-auth.guard";

@Controller('attendance/checkIn')
@UseGuards(AccessGuard, JwtAuthGuard)
export class CheckInCheckoutController{

    constructor(private readonly checkInCheckoutService: CheckInCheckoutService){}

    
}





