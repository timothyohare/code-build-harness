export function createRoleRouter(executors) {
  return async function execute(request) {
    const executor = executors[request.role];
    if (!executor) throw new Error(`no executor configured for role '${request.role}'`);
    return executor(request);
  };
}
