import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // 클라우드 동기화 API
  sync: router({
    // 서버에서 사용자 데이터 가져오기
    pull: protectedProcedure.query(async ({ ctx }) => {
      const data = await db.getUserData(ctx.user.id);
      if (!data) {
        return {
          wrongNums: [] as number[],
          bookmarkNums: [] as number[],
          totalAnswered: 0,
          totalCorrect: 0,
          streakDays: 0,
          lastStudiedAt: "",
        };
      }
      return {
        wrongNums: JSON.parse(data.wrongNums || "[]") as number[],
        bookmarkNums: JSON.parse(data.bookmarkNums || "[]") as number[],
        totalAnswered: data.totalAnswered,
        totalCorrect: data.totalCorrect,
        streakDays: data.streakDays,
        lastStudiedAt: data.lastStudiedAt,
      };
    }),

    // 로컬 데이터를 서버에 업로드 (전체 덮어쓰기)
    push: protectedProcedure
      .input(
        z.object({
          wrongNums: z.array(z.number()),
          bookmarkNums: z.array(z.number()),
          totalAnswered: z.number(),
          totalCorrect: z.number(),
          streakDays: z.number(),
          lastStudiedAt: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.upsertUserData(ctx.user.id, {
          wrongNums: JSON.stringify(input.wrongNums),
          bookmarkNums: JSON.stringify(input.bookmarkNums),
          totalAnswered: input.totalAnswered,
          totalCorrect: input.totalCorrect,
          streakDays: input.streakDays,
          lastStudiedAt: input.lastStudiedAt,
        });
        return { success: true };
      }),

    // 오답만 업데이트
    pushWrong: protectedProcedure
      .input(z.object({ wrongNums: z.array(z.number()) }))
      .mutation(async ({ ctx, input }) => {
        await db.upsertUserData(ctx.user.id, {
          wrongNums: JSON.stringify(input.wrongNums),
        });
        return { success: true };
      }),

    // 북마크만 업데이트
    pushBookmarks: protectedProcedure
      .input(z.object({ bookmarkNums: z.array(z.number()) }))
      .mutation(async ({ ctx, input }) => {
        await db.upsertUserData(ctx.user.id, {
          bookmarkNums: JSON.stringify(input.bookmarkNums),
        });
        return { success: true };
      }),

    // 통계만 업데이트
    pushStats: protectedProcedure
      .input(
        z.object({
          totalAnswered: z.number(),
          totalCorrect: z.number(),
          streakDays: z.number(),
          lastStudiedAt: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.upsertUserData(ctx.user.id, input);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
