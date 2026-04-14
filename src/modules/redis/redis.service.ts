import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

// Registratsiya ma'lumotlari turi
export type UserRedisState =
  | {
      type: 'REGISTRATION';
      step: 'WAITING_NAME' | 'WAITING_PHONE' | 'COMPLETED';
      data: RegistrationData;
    }
  | {
      type: 'REQUEST';
      // SHU YERGA 'REQ_REJECT_REASON' NI QO'SHING:
      step:
        | 'REQ_DISTRICT'
        | 'REQ_MAHALLA'
        | 'REQ_BUILDING'
        | 'REQ_APARTMENT'
        | 'REQ_DESCRIPTION'
        | 'REQ_PHOTO'
        | 'REQ_CONFIRM'
        | 'REQ_REJECT_REASON'; // <-- Mana bu qo'shildi
      data: RequestData;
      metadata?: {
        temp_view_message_ids?: string[];
        temp_reject_request_id?: string;
      };
    }
  | {
      type: 'IDLE';
      step: 'NONE';
      data: {};
    };

    // Registratsiya jarayoni uchun ma'lumotlar
export class RegistrationData {
  full_name?: string;
  phone?: string;
}

// Ariza yaratish jarayoni uchun ma'lumotlar
export class RequestData {
  district?: string;
  neighborhood?: string;
  building_number?: string;
  apartment_number?: string; // xonadon raqami string bo'lgani yaxshi (masalan: 12a)
  description?: string;
  photos?: string[]; // file_id'lar ro'yxati
  latitude?: number;
  longitude?: number;
}

@Injectable()
export class RedisService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  // Ma'lumotni saqlash (1 hafta TTL bilan)
  async setUserState(telegramId: bigint, state: any) {
    const key = `user_state:${telegramId}`;
    await this.redis.set(key, JSON.stringify(state), 'EX', 86400); // 86400 sek = 24 soat || 7 kunga saqlash
  }

  // Ma'lumotni o'qish
  async getUserState(telegramId: bigint): Promise<any | null> {
    const key = `user_state:${telegramId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  } 

  // Ma'lumotni o'chirish (Ariza bitganda)
  async deleteUserState(telegramId: bigint) {
    await this.redis.del(`user_state:${telegramId}`);
  }
}
