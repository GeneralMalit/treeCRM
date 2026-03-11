type QueryResult<T = unknown> = {
  data: T;
  error: { message: string } | null;
};

type TablePlan = {
  list?: QueryResult;
  maybeSingle?: QueryResult;
  single?: QueryResult;
  update?: QueryResult;
  delete?: QueryResult;
};

type SupabasePlan = Record<string, TablePlan>;

function ok<T>(data: T): QueryResult<T> {
  return { data, error: null };
}

function missingResult(): QueryResult<null> {
  return ok(null);
}

function createBuilder(tablePlan: TablePlan, action: "select" | "insert" | "update" | "delete" = "select") {
  const builder = {
    select() {
      return createBuilder(tablePlan, action);
    },
    insert() {
      return createBuilder(tablePlan, "insert");
    },
    update() {
      return createBuilder(tablePlan, "update");
    },
    delete() {
      return createBuilder(tablePlan, "delete");
    },
    eq() {
      return createBuilder(tablePlan, action);
    },
    in() {
      return createBuilder(tablePlan, action);
    },
    order() {
      return createBuilder(tablePlan, action);
    },
    maybeSingle() {
      return Promise.resolve(tablePlan.maybeSingle ?? missingResult());
    },
    single() {
      return Promise.resolve(tablePlan.single ?? missingResult());
    },
    then(onFulfilled: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) {
      const result =
        action === "update"
          ? tablePlan.update ?? ok([])
          : action === "delete"
            ? tablePlan.delete ?? ok([])
          : tablePlan.list ?? ok([]);
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };

  return builder;
}

export function createSupabaseAdminMock(plan: SupabasePlan) {
  return {
    from(table: string) {
      return createBuilder(plan[table] ?? {});
    },
  };
}

export function createSupabaseAuthMock(options?: {
  signUp?: QueryResult;
  signInWithPassword?: QueryResult;
}) {
  return {
    auth: {
      signUp: async () => options?.signUp ?? missingResult(),
      signInWithPassword: async () => options?.signInWithPassword ?? missingResult(),
    },
  };
}

export { ok };
