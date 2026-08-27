import { NextRequest, NextResponse } from 'next/server';

import { authenticate, RouteContext } from '@/middleware/authenticate';
import { Role } from '@prisma/client';

import { userService } from '@/services/user/user.service';
import { ForbiddenError } from '@/lib/errors/forbidden-error';
import { withErrorHandler } from '@/lib/errors/global-handler';
import { getRequestContext } from '@/lib/request-context';
import { ListUsersSchema } from '@/lib/user/user.schema';

export const GET = withErrorHandler(
  authenticate(async (req: NextRequest, ctx?: RouteContext) => {
    const { id } = await ctx!.params;
    const reqCtx = getRequestContext();
    const role = reqCtx?.identity?.role;

    if (role !== Role.PLATFORM_ADMIN) throw new ForbiddenError();

    const { searchParams } = new URL(req.url);
    const query = {
      page: searchParams.get('page') || undefined,
      pageSize: searchParams.get('pageSize') || undefined,
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      role: searchParams.get('role') || undefined,
      excludeRole: searchParams.get('excludeRole') || undefined,
      sort: searchParams.get('sort') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
    };

    const parsedQuery = ListUsersSchema.parse(query);
    const result = await userService.listUsers(id, parsedQuery);

    // Remove passwords
    const safeData = result.data.map((u) => {
      const { password, ...safeUser } = u;
      return safeUser;
    });

    return NextResponse.json({
      data: safeData,
      meta: {
        total: result.total,
        page: parsedQuery.page,
        pageSize: parsedQuery.pageSize,
        totalPages: Math.ceil(result.total / parsedQuery.pageSize),
      },
    });
  }),
);
