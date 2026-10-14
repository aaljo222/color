const jobs = new Map();

export async function mockAsk(text) {
  const job_id = `${Date.now()}-${Math.random()}`;
  jobs.set(job_id, { text, polls: 0 });
  return { job_id };
}

export async function mockResult(jobId) {
  const job = jobs.get(jobId);
  if (!job) {
    const error = new Error("찾을 수 없음");
    error.status = 404;
    throw error;
  }
  job.polls += 1;
  if (job.polls < 3) return { status: job.polls === 1 ? "queued" : "running" };
  jobs.delete(jobId);
  const isQuestion = /왜|인기|흥분|무슨/.test(job.text);
  return {
    status: "done",
    data: {
      source: "paper",
      mode: isQuestion ? "qa" : "scene",
      answer: isQuestion
        ? "색의 선호는 경험과 문화, 맥락이 함께 영향을 줍니다."
        : `${job.text}에서 따뜻하고 생기 있는 색의 장면을 떠올렸어요.`,
      ...(!isQuestion ? { palette: ["#d9785b", "#e9bb63", "#7b9b78"] } : {}),
      note: "로컬 미리보기 응답입니다.",
      citations: [{ cite: "MaC 색채 자료", score: 0.82 }],
    },
  };
}
