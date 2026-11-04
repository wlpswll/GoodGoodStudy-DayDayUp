App({
  onLaunch: function () {
    /* iOS 真机侧边的静音键会让 InnerAudioContext 静音，PC 模拟器不受影响。
     * 这是全局播放选项，必须在创建任何音频实例之前设置。 */
    if (typeof wx !== 'undefined' && typeof wx.setInnerAudioOption === 'function') {
      try {
        wx.setInnerAudioOption({ obeyMuteSwitch: false });
      } catch (e) {}
    }
  }
});
