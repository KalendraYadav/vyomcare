import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get() findAll(@CurrentUser() user: any) {
    return this.svc.findAll(user.userId);
  }
  @Get('unread-count') unreadCount(@CurrentUser() user: any) {
    return this.svc.getUnreadCount(user.userId);
  }
  @Patch(':id/read') markRead(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.markRead(id, user.userId);
  }
  @Patch('mark-all-read') markAllRead(@CurrentUser() user: any) {
    return this.svc.markAllRead(user.userId);
  }
}
