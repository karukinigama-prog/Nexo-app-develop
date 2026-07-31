const GITHUB_API = "https://api.github.com";

function githubHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export async function listUserRepos(token: string) {
  const res = await fetch(`${GITHUB_API}/user/repos?sort=updated&per_page=100`, {
    headers: githubHeaders(token),
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = await res.json();
  return data.map((repo: any) => ({
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description,
    url: repo.html_url,
  }));
}

export async function getRepoContent(token: string, owner: string, repo: string, path: string = "") {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`, {
    headers: githubHeaders(token),
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

export async function updateRepoFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  sha?: string
) {
  let fileSha = sha;
  if (!fileSha) {
    try {
      const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`, {
        headers: githubHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        fileSha = data.sha;
      }
    } catch {}
  }

  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: { ...githubHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: Buffer.from(content).toString("base64"),
      ...(fileSha ? { sha: fileSha } : {}),
    }),
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}
