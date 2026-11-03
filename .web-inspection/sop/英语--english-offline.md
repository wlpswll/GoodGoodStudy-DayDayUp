# 英语跟读离线再播

需求：`features/offline-media-cache`。第一次点开音频并播放成功后，页面提示已保存；再次进入英语页应提示正在使用本机缓存，并且可以继续播放。

## TC-01 播放后留下并在下次打开命中

- 打开 `/english/`，等待音频目录出现。
- 点第一段英语音频，等待「已保存到本机，断网后仍可播放」。
- 再次打开 `/english/`，在还没点播放之前应看到「正在使用本机缓存」。再点播放会把提示改成已保存，本用例停在再次打开这一步。

```ui-cases
cases:
  - id: TC-01
    name: 英语音频播放后留下，再次打开使用本机缓存
    steps:
      - navigate: /english/
      - wait_for: "#library [data-kind='audio'] .cat-item"
      - click: "#library [data-kind='audio'] .cat-item"
      - wait_for: "#offlineHint"
      - navigate: /english/
      - wait_for: "#offlineHint"
    expect:
      - text_contains: { selector: "#offlineHint", text: "正在使用本机缓存" }
      - url_contains: /english/
```
