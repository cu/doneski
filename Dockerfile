ARG PYTHON_IMAGE=docker.io/library/python:3.13-slim

FROM $PYTHON_IMAGE AS builder

# uv settings
ARG UV_LINK_MODE=copy
ARG UV_COMPILE_BYTECODE=1
ARG UV_PYTHON_DOWNLOADS=never
ARG UV_LOCKED=1
ARG UV_PROJECT_ENVIRONMENT=/doneski/.venv

COPY ./ /build/
WORKDIR /build
RUN --mount=type=cache,target=/root/.cache/uv << EOS sh -ex
    pip install --no-cache-dir uv
    uv sync --locked --no-install-project
    TMP=/dev/shm uv run pytest
    uv sync --no-install-project --no-group dev
EOS

FROM $PYTHON_IMAGE

COPY --from=builder --chown=doneski:doneski /doneski/.venv /doneski/.venv
COPY --from=builder --chown=doneski:doneski /build/doneski /doneski
COPY --from=builder --chown=doneski:doneski /build/LICENSE /doneski/

ARG DEBIAN_FRONTEND=noninteractive
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked <<EOS sh -ex
    apt-get update
    apt-get install -yq --no-install-recommends curl
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
    groupadd --gid 5000 doneski
    useradd --create-home --uid 5000 --gid 5000 doneski
EOS

USER doneski
WORKDIR /doneski

EXPOSE 5000

HEALTHCHECK --start-period=10s --timeout=5s \
    CMD curl --fail http://localhost:5000/view/home || exit 1

ENV PYTHONUNBUFFERED=1
ENV DONESKI_DATA=/home/doneski/data
ENV GUNICORN_CMD_ARGS="--bind :5000 --workers 2 --threads 4 --worker-tmp-dir /dev/shm"

CMD ["/doneski/.venv/bin/gunicorn", "'doneski.app:create_app()'"]
