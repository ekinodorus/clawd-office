"""Quick test: does claude_code_sdk.query() work at all?"""
import asyncio
import sys
import claude_code_sdk as sdk


async def main():
    print("Starting query...")
    options = sdk.ClaudeCodeOptions(
        max_turns=1,
        permission_mode="acceptEdits",
        debug_stderr=sys.stderr,
    )
    async for msg in sdk.query(prompt="Say hello in one word", options=options):
        print(f"  {type(msg).__name__}: {repr(msg)[:200]}")
    print("Done.")


asyncio.run(main())
