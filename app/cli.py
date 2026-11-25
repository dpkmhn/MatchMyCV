"""Command line: python -m app.cli RESUME JOB [--out report.md] [--json report.json]"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

from app.config import get_settings
from app.documents import DocumentError, read_path
from app.graph.builder import run
from app.report import to_markdown


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Optimize a resume for a job description.")
    parser.add_argument("resume", help="Resume file (.pdf, .docx, .txt, .md)")
    parser.add_argument("job", help="Job description file (.txt, .md, .pdf, .docx)")
    parser.add_argument("--out", help="Write the Markdown report here instead of stdout")
    parser.add_argument("--json", dest="json_out", help="Also write the full structured report")
    parser.add_argument("-v", "--verbose", action="store_true", help="Log each workflow step")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING, format="%(message)s"
    )

    settings = get_settings()
    if settings.missing_keys():
        print("GROQ_API_KEY is not set. Copy .env.example to .env and add it.", file=sys.stderr)
        return 2
    try:
        resume_text, job_text = read_path(args.resume), read_path(args.job)
    except (DocumentError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    for label, text in (("resume", resume_text), ("job description", job_text)):
        if len(text) > settings.max_input_chars:
            print(
                f"error: the {label} is longer than {settings.max_input_chars} characters.",
                file=sys.stderr,
            )
            return 2

    report = asyncio.run(run(resume_text, job_text))
    md = to_markdown(report)
    if args.out:
        Path(args.out).write_text(md, encoding="utf-8")
        print(f"Report written to {args.out} (match {report.score.overall}/100)")
    else:
        sys.stdout.reconfigure(encoding="utf-8")
        print(md)
    if args.json_out:
        Path(args.json_out).write_text(report.model_dump_json(indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
