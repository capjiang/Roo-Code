# secanalyzer Docker 用法

该目录下的 `Dockerfile` 会把 `tool/jsa-linux-1.0/secanalyzer` 打包成一个可一次性运行的镜像。

## 1) 构建镜像

在仓库根目录执行：

```bash
docker build -t secanalyzer:local .
```

## 2) 分析挂载的目录（推荐）

把待分析代码挂载到 `/input`，把输出目录挂载到 `/output`：

```bash
mkdir -p out
docker run --rm \
  -v "$PWD/test":/input \
  -v "$PWD/out":/output \
  secanalyzer:local \
  /input --project=demo --outFormat=sarif
```

运行完成后，结果会输出到宿主机的 `./out/` 目录中。

## 3) 分析单个文件

```bash
docker run --rm \
  -v "$PWD/app.js":/input/app.js:ro \
  -v "$PWD/out":/output \
  secanalyzer:local \
  /input/app.js --project=demo
```

## 4) 默认输出路径与日志

容器会自动补齐以下默认参数（如果你没有显式传入对应选项）：

- `--outPath=/output`
- `--irPath=/output/dlir`
- `--log=/output/log/<project>.log`

你也可以自行覆盖，例如：

```bash
docker run --rm \
  -v "$PWD/test":/input \
  -v "$PWD/out":/output \
  secanalyzer:local \
  /input --project=myproj --outPath=/output/results --log=/output/myproj.log
```

## 5) Linux 下避免输出文件属主为 root（可选）

如果你希望输出文件在宿主机上归当前用户所有，可以运行：

```bash
mkdir -p out
docker run --rm \
  --user "$(id -u)":"$(id -g)" \
  -v "$PWD/test":/input \
  -v "$PWD/out":/output \
  secanalyzer:local \
  /input --project=demo
```
