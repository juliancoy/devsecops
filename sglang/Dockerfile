ARG CUDA_VERSION=12.1.1
FROM nvidia/cuda:${CUDA_VERSION}-devel-ubuntu20.04
ARG BUILD_TYPE=all
ENV DEBIAN_FRONTEND=noninteractive

RUN echo 'tzdata tzdata/Areas select America' | debconf-set-selections \
    && echo 'tzdata tzdata/Zones/America select Los_Angeles' | debconf-set-selections \
    && apt update -y \
    && apt install software-properties-common -y \
    && add-apt-repository ppa:deadsnakes/ppa -y && apt update \
    && apt install python3.10 python3.10-dev -y \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.8 1 && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.10 2 \
    && update-alternatives --set python3 /usr/bin/python3.10 && apt install python3.10-distutils -y \
    && apt install curl git sudo libibverbs-dev -y \
    && curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py && python3 get-pip.py \
    && python3 --version \
    && python3 -m pip --version \
    && rm -rf /var/lib/apt/lists/* \
    && apt clean

# For openbmb/MiniCPM models
RUN pip3 install datamodel_code_generator

WORKDIR /sgl-workspace

ARG CUDA_VERSION
RUN python3 -m pip install --upgrade pip setuptools wheel html5lib six \
    && git clone --depth=1 https://github.com/sgl-project/sglang.git \
    && if [ "$CUDA_VERSION" = "12.1.1" ]; then \
         python3 -m pip install torch --index-url https://download.pytorch.org/whl/cu121; \
       elif [ "$CUDA_VERSION" = "12.4.1" ]; then \
         python3 -m pip install torch --index-url https://download.pytorch.org/whl/cu124; \
       elif [ "$CUDA_VERSION" = "11.8.0" ]; then \
         python3 -m pip install torch --index-url https://download.pytorch.org/whl/cu118; \
       else \
         echo "Unsupported CUDA version: $CUDA_VERSION" && exit 1; \
       fi \
    && cd sglang \
    && if [ "$BUILD_TYPE" = "srt" ]; then \
         if [ "$CUDA_VERSION" = "12.1.1" ]; then \
           python3 -m pip --no-cache-dir install -e "python[srt]" --find-links https://flashinfer.ai/whl/cu121/torch2.4/flashinfer/; \
         elif [ "$CUDA_VERSION" = "12.4.1" ]; then \
           python3 -m pip --no-cache-dir install -e "python[srt]" --find-links https://flashinfer.ai/whl/cu124/torch2.4/flashinfer/; \
         elif [ "$CUDA_VERSION" = "11.8.0" ]; then \
           python3 -m pip --no-cache-dir install -e "python[srt]" --find-links https://flashinfer.ai/whl/cu118/torch2.4/flashinfer/; \
         else \
           echo "Unsupported CUDA version: $CUDA_VERSION" && exit 1; \
         fi; \
       else \
         if [ "$CUDA_VERSION" = "12.1.1" ]; then \
           python3 -m pip --no-cache-dir install -e "python[all]" --find-links https://flashinfer.ai/whl/cu121/torch2.4/flashinfer/; \
         elif [ "$CUDA_VERSION" = "12.4.1" ]; then \
           python3 -m pip --no-cache-dir install -e "python[all]" --find-links https://flashinfer.ai/whl/cu124/torch2.4/flashinfer/; \
         elif [ "$CUDA_VERSION" = "11.8.0" ]; then \
           python3 -m pip --no-cache-dir install -e "python[all]" --find-links https://flashinfer.ai/whl/cu118/torch2.4/flashinfer/; \
         else \
           echo "Unsupported CUDA version: $CUDA_VERSION" && exit 1; \
         fi; \
       fi

RUN python3 -m pip cache purge

ENV DEBIAN_FRONTEND=interactive