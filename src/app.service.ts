import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello Bhushan!';
  }

  passwordHash(password: string): string {
    return password;
  }
}
