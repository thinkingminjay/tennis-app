# 시작하기

1. 이 폴더(claude-code-kit)의 파일을 새 프로젝트 폴더 맨 위에 그대로 복사한다. (`.mcp.json`, `.env.example`, `.gitignore`는 숨김 파일이니 함께 복사)
2. `.env.example`을 `.env`로 복사하고 값을 채운다.
3. Lazyweb 토큰을 셸 환경변수로 넣는다: `export LAZYWEB_TOKEN=...` (Lazyweb 사이트에서 무료 가입 후 발급. Claude Code는 .mcp.json의 `${LAZYWEB_TOKEN}`을 환경변수에서 읽는다). 토큰이 없으면 Lazyweb만 연결 실패하고 나머지는 정상 동작한다.
4. 그 폴더에서 `claude` 실행 → 프로젝트 MCP 서버 사용을 묻는 창에서 승인. `/mcp`로 연결 상태를 확인한다. Inspo는 로그인이 필요 없다.
5. 첫 요청 예: "docs/POC.md 체크리스트를 순서대로 진행하자. 먼저 Expo 프로젝트를 apps/mobile에 만들고 웹뷰 스파이크부터."

## 명령어로 직접 추가하고 싶다면 (.mcp.json 대신)

```bash
claude mcp add --transport http lazyweb https://www.lazyweb.com/mcp --header "Authorization: Bearer <Lazyweb 토큰>"
claude mcp add --transport http inspo https://inspomcp.dev/api/mcp
```

여러 프로젝트에서 쓰려면 각 명령에 `--scope user`를 붙인다.

## 제외한 MCP

Mobbin, Nicelydone, Refero는 MCP 사용에 유료 플랜이 필요해 제외했다. 나중에 쓰게 되면 각 서비스 문서의 주소로 `claude mcp add --transport http ...`로 추가하면 된다.
