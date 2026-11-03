# 古诗朗读离线再播

需求：`features/offline-media-cache`。从封面开始诵读后，朗读音频留在本机；再次打开同一首应提示正在使用本机缓存，并可以继续朗读。

## TC-01 诵读后留下并在下次打开命中

- 打开 `/gushi/`，等诗卷加载完。
- 点「开始诵读」，等待「已保存到本机，断网后仍可播放」。
- 打开 `/gushi/#/p/1`，在还没点播放之前应看到「正在使用本机缓存」。

```ui-cases
cases:
  - id: TC-01
    name: 古诗朗读后留下，再次打开使用本机缓存
    steps:
      - navigate: /gushi/
      - wait_ms: 1500
      - click: "#startBtn"
      - wait_for: "#offlineHint"
      - navigate: /gushi/#/p/1
      - wait_ms: 1500
      - wait_for: "#offlineHint"
    expect:
      - text_contains: { selector: "#offlineHint", text: "正在使用本机缓存" }
      - url_contains: "#/p/1"
```
