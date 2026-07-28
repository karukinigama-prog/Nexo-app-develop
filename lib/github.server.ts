import { Octokit } from "octokit";

export async function getGitHubClient(token: string) {
  return new Octokit({ auth: token });
}

export async function listUserRepos(token: string) {
  const octokit = await getGitHubClient(token);
  const { data } = await octokit.rest.repos.listForAuthenticatedUser({
    sort: "updated",
    per_page: 100,
  });
  return data.map(repo => ({
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description,
    url: repo.html_url,
  }));
}

export async function getRepoContent(token: string, owner: string, repo: string, path: string = "") {
  const octokit = await getGitHubClient(token);
  const { data } = await octokit.rest.repos.getContent({
    owner,
    repo,
    path,
  });
  return data;
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
  const octokit = await getGitHubClient(token);
  
  let fileSha = sha;
  if (!fileSha) {
    try {
      const { data }: any = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
      });
      fileSha = data.sha;
    } catch (e) {
    }
  }

  const { data } = await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content: Buffer.from(content).toString("base64"),
    sha: fileSha,
  });
  return data;
}
