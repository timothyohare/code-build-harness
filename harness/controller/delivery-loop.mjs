export function createDeliveryLoop({ buildLoop, reviewLoop }) {
  return {
    async run(task) {
      const build = await buildLoop.runBuildTask(task);
      if (build.status !== 'green') return { status: build.status, build, review: null };
      const review = await reviewLoop.run();
      return { status: review.status === 'approved' ? 'approved' : review.status, build, review };
    },
  };
}
