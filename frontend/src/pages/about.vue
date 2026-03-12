<template>
    <header class="heading-row">
      <h2>FAQs</h2>
    </header>
<UCard>
    
    <div class="markdown-body">
<h2>1. 搜索结果不准确</h2>
<p>搜索使用的索引数据直接来源于mkdocs search生成的search_index.json文件，理论上应该和mkdocs内置搜索结果一致。不过mkdocs内置搜索本身其实也不是特别智能，尤其是对于中文内容，搜索结果可能不太理想。</p>
<h2>2. 你选择了哪些notebook？我希望能移除/添加某些notebook。</h2>
<p>我选用的是<a href="https://isshikihugh.github.io/zju-cs-asio/" target="_blank" rel="noopener">ZJU CS - All Sum in One!</a>中包含的notebook列表。</p>
<p>你可以自行在服务器上搭建notebookshelf，并在配置文件中指定你想要收录的notebook列表。</p>
<p>如果你认为某些notebook侵犯了版权或者不适合被收录，可以提交issue告诉我，我会尽快处理。</p>
<h2>3. 版权问题</h2>
<p><strong>本站不是资源搬运站</strong>，不会向用户展示文章全文，而是引导用户访问原文。</p>
<h2>4. 能不能做成纯静态的，避免绑定特定人的服务器？</h2>
<p>对此的考量是这样的：Notebookshelf里会包含很多notebook，如果做成纯静态的，那么每次搜索都需要下载所有notebook的search_index.json，流量和性能都会很糟糕。</p>
<p>可能会考虑另外做一个静态版本，使用PWA+indexDB实现，方便离线使用。</p>
<h2>5. 代码质量好烂，设计好烂，，，</h2>
<p>向您致歉。这个项目是我业余时间的兴趣项目，<del>看到没人实现就随手做了一个</del>，也许只是一个抛砖引玉的作用。</p>
<p>项目的逻辑和技术含量并不复杂，你可以在<a href="https://blog.5dbwat4.top/arch/2026-3-notebookshelf" target="_blank" rel="noopener">我的博客中了解详情</a>。</p>
<p>代码开源，你可以自行修改或者重写一个你更满意的版本。（欢迎PR）</p>
    </div>
</UCard>
</template>
<script setup>
import "github-markdown-css/github-markdown.css";
/**

# FAQs

## 1. 搜索结果不准确

搜索使用的索引数据直接来源于mkdocs search生成的search_index.json文件，理论上应该和mkdocs内置搜索结果一致。不过mkdocs内置搜索本身其实也不是特别智能，尤其是对于中文内容，搜索结果可能不太理想。

## 2. 你选择了哪些notebook？我希望能移除/添加某些notebook。

我选用的是[ZJU CS - All Sum in One!](https://isshikihugh.github.io/zju-cs-asio/)中包含的notebook列表。

你可以自行在服务器上搭建notebookshelf，并在配置文件中指定你想要收录的notebook列表。

如果你认为某些notebook侵犯了版权或者不适合被收录，可以提交issue告诉我，我会尽快处理。

## 3. 版权问题

**本站不是资源搬运站**，不会向用户展示文章全文，而是引导用户访问原文。

## 4. 能不能做成纯静态的，避免绑定特定人的服务器？

对此的考量是这样的：Notebookshelf里会包含很多notebook，如果做成纯静态的，那么每次访问都需要下载所有notebook的search_index.json，流量和性能都会很糟糕。

可能会考虑另外做一个静态版本，使用PWA+indexDB实现，方便离线使用。

## 5. 代码质量好烂，设计好烂，，，

向您致歉。这个项目是我业余时间的兴趣项目，~~看到没人实现就随手做了一个~~，也许只是一个抛砖引玉的作用。

项目的逻辑和技术含量并不复杂，你可以在[我的博客中了解详情](https://blog.5dbwat4.top/arch/2026-3-notebookshelf)。

代码开源，你可以自行修改或者重写一个你更满意的版本。（欢迎PR）


 */
</script>
<style scoped>
.heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.heading-row h2 {
  margin: 0;
  font-size: 1.3rem;
  font-family: "Monomakh", system-ui;
}
</style>