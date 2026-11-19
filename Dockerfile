ARG PYTHON_IMAGE=docker.io/library/python:3.13-slim

FROM $PYTHON_IMAGE AS builder

# uv settings
ARG UV_LINK_MODE=copy
ARG UV_COMPILE_BYTECODE=1
ARG UV_PYTHON_DOWNLOADS=never
ARG UV_PROJECT_ENVIRONMENT=/doneski/.venv

COPY ./ /build/
WORKDIR /build
RUN --mount=type=cache,target=/root/.cache/uv << EOS sh -ex
    pip install --no-cache-dir uv
    uv sync --locked --no-install-project
    TMPDIR=/dev/shm uv run pytest
    uv sync --locked --no-install-project --no-group dev
EOS

FROM $PYTHON_IMAGE

ARG DEBIAN_FRONTEND=noninteractive
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked <<EOS sh -ex
    apt-get update
    apt-get install -yq --no-install-recommends curl
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
    groupadd --gid 5000 doneski
    useradd --create-home --uid 5000 --gid 5000 doneski
    install -d -o 5000 -g 5000 /data
EOS

COPY --from=builder --chown=5000:5000 /doneski/.venv /doneski/.venv
COPY --from=builder --chown=5000:5000 /build/doneski /doneski/doneski
COPY --from=builder --chown=5000:5000 /build/LICENSE /doneski/

USER doneski
WORKDIR /doneski

EXPOSE 5000

VOLUME /data

HEALTHCHECK --start-period=10s --timeout=5s \
    CMD curl --fail http://localhost:5000/healthz || exit 1

ENV PYTHONUNBUFFERED=1
ENV DONESKI_DATA=/data
ENV GUNICORN_CMD_ARGS="--bind :5000 --workers 1 --threads 8 --worker-tmp-dir /dev/shm --access-logfile -"

CMD ["/doneski/.venv/bin/gunicorn", "doneski.app:create_app()"]
