import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

// CORS origin is driven by environment — same as the HTTP API CORS config.
// Development: http://localhost:3000 (CORS_ORIGIN in .env)
// Production:  set CORS_ORIGIN to your production frontend domain.
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('join')
  handleJoin(
    @MessageBody() data: { userId: string; role: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`user:${data.userId}`);
    client.join(`role:${data.role}`);
    return { event: 'joined', data: { userId: data.userId } };
  }

  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitToRole(role: string, event: string, data: any) {
    this.server.to(`role:${role}`).emit(event, data);
  }

  emitAlert(alert: any) {
    // Emit to Government and Super Admin
    this.server.to('role:GOVERNMENT_AUTHORITY').emit('alert:new', alert);
    this.server.to('role:SUPER_ADMIN').emit('alert:new', alert);
  }

  emitTransportUpdate(assignment: any) {
    this.server
      .to('role:GOVERNMENT_AUTHORITY')
      .emit('transport:update', assignment);
    this.server.to('role:HOSPITAL_ADMIN').emit('transport:update', assignment);
    this.server.to('role:SUPER_ADMIN').emit('transport:update', assignment);
  }
}
