// import {
//   CanActivate,
//   ExecutionContext,
//   Injectable,
//   UnauthorizedException,
// } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { JwtService } from '@nestjs/jwt';
// import { Roles } from '@prisma/client';
// import { PrismaService } from 'src/core/database/prisma.service';

// @Injectable()
// export class TokenGuard implements CanActivate {
//   constructor(
//     private config: ConfigService,
//     private jwt: JwtService,
//     private prisma: PrismaService,
//   ) {}
//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     try {
//       const req = context.switchToHttp().getRequest();
//       let token = req.headers.authorization;

//       if (!token && req.query.token) {
//         token = `Bearer ${req.query.token}`;
//       }

//       if (!token || !token.startsWith('Bearer ')) {
//         throw new UnauthorizedException('Token mavjud emas yoki buzilgan');
//       }
//       const payload = await this.jwt.verifyAsync(token.split(' ')[1], {
//         secret: this.config.get('JWT_SECRET'),
//       });

//       let user:any

//       if(payload.role===Roles.User){

//         user = await this.prisma.users.findUnique({
//           where: { id: payload.id },
//           select: {
//             id: true,
//             phoneNumber:true,
//             role: true,
//           },
//         });
//       }else if (
//         payload.role === Roles.INSPECTION ||
//         payload.role === Roles.JEK ||
//         payload.role === Roles.GOVERNMENT
//       ) {
//         user = await this.prisma.admins.findUnique({
//           where: { id: payload.id },
//           select: {
//             id: true,
//             phoneNumber: true,
//             role: true,
//           },
//         });
//       }

//       if (!user) {
//         throw new UnauthorizedException('Foydalanuvchi topilmadi');
//       }

//       req['user'] = user;
//       return true;
//     } catch (error) {
//       if (error instanceof UnauthorizedException) {
//         throw error;
//       }
//       throw new UnauthorizedException('Token mavjud emas yoki buzilgan');
//     }
//   }
// }

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { jekRoles } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma.service';

@Injectable()
export class TokenGuard implements CanActivate {
  constructor(
    private config: ConfigService,
    private jwt: JwtService,
    private prisma: PrismaService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    let authHeader = req.headers.authorization;
    let token = '';

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query.token) {
      token = req.query.token as string;
    }

    if (!token) throw new UnauthorizedException('Token topilmadi');

    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
      });

      let user: any = null;

      if (payload.role === jekRoles.User) {
        user = await this.prisma.users.findUnique({
          where: { id: payload.id },
          select: { id: true, role: true, phoneNumber: true },
        });
      } else {
        user = await this.prisma.admins.findUnique({
          where: { id: payload.id },
          select: { id: true, role: true, jti: true, isActive: true, address: true },
        });

        if (user && user.jti !== payload.jti) {
          throw new UnauthorizedException(
            'Sessiya eskirgan yoki boshqa qurilmadan kirilgan',
          );
        }
      }

      if (!user) throw new UnauthorizedException('Foydalanuvchi topilmadi');

      req['user'] = user;
      return true;
    } catch (e) {
      throw new UnauthorizedException(e.message || 'Token yaroqsiz');
    }
  }
}