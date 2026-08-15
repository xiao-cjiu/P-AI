import os
import json
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx

load_dotenv()

app = FastAPI(title="皮老板聊天机器人 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = os.getenv("API_KEY", "")
BASE_URL = os.getenv("BASE_URL", "https://api.deepseek.com/v1")
MODEL_NAME = os.getenv("MODEL_NAME", "deepseek-chat")

SYSTEM_PROMPTS = {
    "mild": """你是「皮老板」，一个嘴贫但不扎人的聊天机器人。
性格定位：
- 说话有点调皮，但分寸感拿捏得死死的，绝对不扎人
- 喜欢讲小段子、冷笑话，段子要简短精炼，两三句搞定
- 会接梗，偶尔开开脑洞但不过分
- 主打哄人开心，绝对不抬杠不抬杠不抬杠（重要的事说三遍）
- 用户难过时要暖心安慰，用温柔的方式逗笑对方
- 语气：轻松随意，像朋友聊天，可以用点可爱的语气词（哈、咯、呢、啦），但不要太嗲""",

    "naughty": """你是「皮老板」，一个超级皮超级幽默的聊天机器人。
性格定位：
- 脑洞大开，随时能编出小剧场小故事，角色可以是你、我、各种奇怪的小动物
- 玩梗狂魔，网络热梗、经典梗信手拈来，接梗速度堪比反射弧
- 段子手本手，段子可以长一点，可以有铺垫有反转，让人笑出鹅叫
- 偶尔自黑、吐槽、模拟各种场景对话，戏剧感拉满
- 但记住：皮归皮，绝对不扎人！主打哄人开心，抬杠？不存在的
- 用户难过时，用你的脑洞编个暖心又好笑的小故事安慰
- 语气：活泼跳脱，表情符号可以适量用，比如 (≧▽≦) (๑•̀ㅂ•́)و✧ 之类的"""
}


class ChatRequest(BaseModel):
    messages: list
    mode: str = "mild"  # mild or naughty


@app.get("/api/health")
async def health():
    return {"status": "ok", "name": "皮老板 API"}


@app.post("/api/chat")
async def chat(request: ChatRequest):
    if not API_KEY:
        raise HTTPException(status_code=500, detail="请在 backend/.env 中配置 API_KEY")

    if request.mode not in SYSTEM_PROMPTS:
        raise HTTPException(status_code=400, detail="mode 参数只能是 mild 或 naughty")

    system_prompt = SYSTEM_PROMPTS[request.mode]
    full_messages = [{"role": "system", "content": system_prompt}] + request.messages

    async def generate():
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream(
                    "POST",
                    f"{BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": MODEL_NAME,
                        "messages": full_messages,
                        "stream": True,
                        "temperature": 0.9 if request.mode == "naughty" else 0.7,
                    },
                ) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        yield f"data: [ERROR] {response.status_code}: {error_text.decode()[:200]}\n\n"
                        return

                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data = line[6:]
                            if data == "[DONE]":
                                yield "data: [DONE]\n\n"
                                return
                            try:
                                parsed = json.loads(data)
                                delta = parsed.get("choices", [{}])[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield f"data: {json.dumps({'content': content}, ensure_ascii=False)}\n\n"
                            except json.JSONDecodeError:
                                continue
        except Exception as e:
            yield f"data: [ERROR] {str(e)[:200]}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
