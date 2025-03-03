/**
 * Instagram リサーチツール
 * フロントエンド JavaScript
 */

console.log("✅ script.js が正常に読み込まれました！");

// ✅ UI要素の取得（nullチェック用に || {}を追加）
const searchButton = document.getElementById("searchButton") || {};
const searchQuery = document.getElementById("searchQuery") || {};
const sortBy = document.getElementById("sortBy") || {};
const timeFrame = document.getElementById("timeFrame") || {};
const engagementFilter = document.getElementById("engagementFilter") || {};
const exportButton = document.getElementById("exportButton") || {};
const accessToken = document.getElementById("accessToken") || {};
const userId = document.getElementById("userId") || {};
const sheetId = document.getElementById("sheetId") || {};
const scriptUrl = document.getElementById("scriptUrl") || {};
const saveSettingsButton = document.getElementById("saveSettingsButton") || {};
const showSettingsButton = document.getElementById("showSettingsButton") || {};
const setupSection = document.getElementById("setupSection") || {};
const results = document.getElementById("results") || {};
const resultsArea = document.getElementById("resultsArea") || {};
const copyGASButton = document.getElementById("copyGASButton") || {};
const gasCodePreview = document.getElementById("gasCodePreview") || {};

// ガイドボタンのイベントリスナー
const showGuideButton = document.getElementById("showGuideButton") || {};
const closeGuideButton = document.getElementById("closeGuideButton") || {};
const guideSection = document.getElementById("guideSection") || {};

// Google Apps Scriptのコード
const GAS_CODE = `/**
 * Instagram リサーチツール用 Google Apps Script
 */

function doGet() {
  return ContentService.createTextOutput("The script is working. Use POST requests.");
}

function doPost(e) {
  try {
    // POSTデータをパース
    const data = JSON.parse(e.postData.contents);
    const sheetId = data.sheetId;
    const searchQuery = data.searchQuery;
    const posts = data.posts;
    
    // スプレッドシートを開く
    let spreadsheet = SpreadsheetApp.openById(sheetId);
    
    // シート名を作成
    const sheetName = (searchQuery.length > 20) 
      ? searchQuery.substring(0, 20) + "..." 
      : searchQuery;
    
    // シートを取得または作成
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
    }
    
    // ヘッダー行を設定
    const headers = ["ユーザー名", "フォロワー数", "いいね数", "コメント数", "推定再生数", "推定値フラグ", 
                    "信頼区間下限", "信頼区間上限", "いいねエンゲージメント率", "再生エンゲージメント率", 
                    "URL", "投稿日時", "検索クエリ"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    
    // データ行を作成
    const rows = posts.map(post => [
      post.username,
      post.followers,
      post.likes,
      post.comments,
      post.estimatedViews,
      post.isEstimated,
      post.confidenceLower,
      post.confidenceUpper,
      post.engagementRateLikes,
      post.engagementRateViews,
      post.url,
      post.timestamp,
      post.searchQuery
    ]);
    
    // データを書き込む
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
    
    // 列幅を自動調整
    sheet.autoResizeColumns(1, headers.length);
    
    // 成功レスポンスを返す
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: \`\${rows.length}件のデータがスプレッドシートに保存されました。\`
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    // エラーレスポンスを返す
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doOptions(e) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "1728000"
  };
  
  return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT)
    .setHeaders(headers);
}`;

// 変数
let allPosts = []; // 検索結果を保存する配列
let SCRIPT_URL = ""; // 保存された設定から読み込む

// ✅ 初期化処理
document.addEventListener('DOMContentLoaded', function() {
    // GASコード表示
    if (gasCodePreview) {
        gasCodePreview.textContent = GAS_CODE;
    }
    
    // 保存された設定を読み込む
    loadSettings();
    
    // 設定が完了していればセットアップセクションを非表示
    if (hasValidSettings() && setupSection) {
        setupSection.classList.add('hidden');
    }
    
    // ガイドボタンのイベントリスナー
    if (showGuideButton) {
        showGuideButton.addEventListener('click', function() {
            if (guideSection && guideSection.classList) {
                guideSection.classList.remove('hidden');
            }
        });
    }

    if (closeGuideButton) {
        closeGuideButton.addEventListener('click', function() {
            if (guideSection && guideSection.classList) {
                guideSection.classList.add('hidden');
            }
        });
    }

    // 初回訪問時にガイドを表示
    if (!localStorage.getItem('instagramToolGuideShown') && guideSection && guideSection.classList) {
        guideSection.classList.remove('hidden');
        localStorage.setItem('instagramToolGuideShown', 'true');
    }
    
    // コピーボタン
    if (copyGASButton) {
        copyGASButton.addEventListener('click', function() {
            navigator.clipboard.writeText(GAS_CODE)
                .then(() => {
                    alert('GASコードがクリップボードにコピーされました。');
                })
                .catch(err => {
                    alert('コピーに失敗しました。手動でコピーしてください。');
                });
        });
    }
    
    // 検索ボタン
    if (searchButton) {
        searchButton.addEventListener("click", function() {
            if (!hasValidSettings()) {
                alert('先に設定を行なってください');
                if (setupSection) {
                    setupSection.classList.remove('hidden');
                }
                return;
            }

            if (!searchQuery || !searchQuery.value || !searchQuery.value.trim()) {
                alert("ハッシュタグを入力してください");
                return;
            }
            
            if (results) results.innerHTML = "";
            allPosts = [];
            if (resultsArea) {
                resultsArea.classList.add("hidden");
            }
            
            performSearch();
        });
    }
    
    // エクスポートボタン
    if (exportButton) {
        exportButton.addEventListener("click", function() {
            if (!hasValidSettings()) {
                alert('先に設定を行なってください');
                if (setupSection) {
                    setupSection.classList.remove('hidden');
                }
                return;
            }

            if (allPosts.length === 0) {
                alert("検索結果がありません。先に検索を実行してください。");
                return;
            }
            
            exportToSpreadsheet();
        });
    }
    
    // 設定表示ボタン
    if (showSettingsButton) {
        showSettingsButton.addEventListener('click', function() {
            if (setupSection) {
                setupSection.classList.remove('hidden');
            }
        });
    }
    
    // 設定保存ボタン
    if (saveSettingsButton) {
        saveSettingsButton.addEventListener('click', function() {
            if (!validateSettings()) return;
            
            const accessTokenValue = accessToken.value.trim();
            const userIdValue = userId.value.trim();
            const scriptUrlValue = scriptUrl.value.trim();
            const sheetIdValue = sheetId.value.trim();
            
            localStorage.setItem('instagramAccessToken', accessTokenValue);
            localStorage.setItem('instagramUserId', userIdValue);
            localStorage.setItem('instagramScriptUrl', scriptUrlValue);
            localStorage.setItem('instagramSheetId', sheetIdValue);
            SCRIPT_URL = scriptUrlValue;
            
            alert('設定を保存しました！これでツールを使用できます。');
            if (setupSection) {
                setupSection.classList.add('hidden');
            }
        });
    }
});

// 設定の検証
function validateSettings() {
    if (!accessToken || !accessToken.value) {
        alert('Instagramアクセストークンを入力してください');
        if (accessToken && accessToken.focus) accessToken.focus();
        return false;
    }
    
    if (!userId || !userId.value) {
        alert('InstagramユーザーIDを入力してください');
        if (userId && userId.focus) userId.focus();
        return false;
    }
    
    if (!scriptUrl || !scriptUrl.value) {
        alert('スクリプトURLを入力してください');
        if (scriptUrl && scriptUrl.focus) scriptUrl.focus();
        return false;
    }
    
    if (!sheetId || !sheetId.value) {
        alert('スプレッドシートIDを入力してください');
        if (sheetId && sheetId.focus) sheetId.focus();
        return false;
    }
    
    return true;
}

// ✅ 設定の読み込み
function loadSettings() {
    const savedAccessToken = localStorage.getItem('instagramAccessToken');
    const savedUserId = localStorage.getItem('instagramUserId');
    const savedScriptUrl = localStorage.getItem('instagramScriptUrl');
    const savedSheetId = localStorage.getItem('instagramSheetId');
    
    if (savedAccessToken && accessToken) {
        accessToken.value = savedAccessToken;
    }
    
    if (savedUserId && userId) {
        userId.value = savedUserId;
    }
    
    if (savedScriptUrl) {
        if (scriptUrl) scriptUrl.value = savedScriptUrl;
        SCRIPT_URL = savedScriptUrl;
    }
    
    if (savedSheetId && sheetId) {
        sheetId.value = savedSheetId;
    }
}

// ✅ 設定が有効かチェック
function hasValidSettings() {
    return localStorage.getItem('instagramAccessToken') && 
           localStorage.getItem('instagramUserId') &&
           localStorage.getItem('instagramScriptUrl') &&
           localStorage.getItem('instagramSheetId');
}

// 検索実行
async function performSearch() {
    if (!results) return;
    
    results.innerHTML = '<div class="col-span-full text-center"><div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-pink-600"></div><p class="mt-2">検索中...</p></div>';
    
    const token = localStorage.getItem('instagramAccessToken');
    const user = localStorage.getItem('instagramUserId');
    if (!token || !user) {
        alert('Instagram認証情報が設定されていません');
        return;
    }

    const hashtag = searchQuery.value.trim();
    
    try {
        // ハッシュタグIDを取得
        const hashtagResponse = await fetch(`https://graph.instagram.com/ig_hashtag_search?user_id=${user}&q=${hashtag}&access_token=${token}`);
        
        if (!hashtagResponse.ok) {
            throw new Error(`ハッシュタグ検索エラー: ${hashtagResponse.status}`);
        }
        
        const hashtagData = await hashtagResponse.json();
        
        if (!hashtagData.data || hashtagData.data.length === 0) {
            results.innerHTML = '<div class="col-span-full text-center text-gray-500">ハッシュタグが見つかりませんでした</div>';
            return;
        }
        
        const hashtagId = hashtagData.data[0].id;
        
        // ハッシュタグに関連する投稿を取得
        const timeFilter = timeFrame.value === 'day' ? 'recent_media' : 'top_media';
        const mediaResponse = await fetch(
            `https://graph.instagram.com/${hashtagId}/${timeFilter}?user_id=${user}&fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username,like_count,comments_count&access_token=${token}`
        );
        
        if (!mediaResponse.ok) {
            throw new Error(`メディア取得エラー: ${mediaResponse.status}`);
        }
        
        const mediaData = await mediaResponse.json();
        
        if (!mediaData.data || mediaData.data.length === 0) {
            results.innerHTML = '<div class="col-span-full text-center text-gray-500">投稿が見つかりませんでした</div>';
            return;
        }
        
        // リール動画のみにフィルタリング
        const reelPosts = mediaData.data.filter(post => 
            post.media_type === 'VIDEO' || post.media_type === 'REEL'
        );
        
        if (reelPosts.length === 0) {
            results.innerHTML = '<div class="col-span-full text-center text-gray-500">リール動画が見つかりませんでした</div>';
            return;
        }
        
        // 各投稿のユーザー情報を取得してエンリッチ
        const enrichedPosts = await Promise.all(
            reelPosts.map(async post => {
                try {
                    // ユーザー情報を取得
                    const userResponse = await fetch(
                        `https://graph.instagram.com/${post.username}?fields=id,username,follows_count,followers_count,media_count&access_token=${token}`
                    );
                    
                    if (!userResponse.ok) {
                        // ユーザー情報が取得できない場合は推定値を使用
                        return {
                            ...post,
                            followerCount: 10000, // デフォルト値
                            isFollowerEstimated: true
                        };
                    }
                    
                    const userData = await userResponse.json();
                    
                    // 再生回数を推定
                    const viewCount = estimateViewCount(post.like_count, post.comments_count, userData.followers_count || 10000);
                    
                    return {
                        ...post,
                        followerCount: userData.followers_count || 10000,
                        isFollowerEstimated: !userData.followers_count,
                        viewCount: viewCount.estimated,
                        viewCountConfidence: viewCount.confidenceInterval,
                        isViewCountEstimated: true
                    };
                } catch (error) {
                    console.error(`ユーザー情報取得エラー: ${error}`);
                    // エラー時はデフォルト値を使用
                    return {
                        ...post,
                        followerCount: 10000,
                        isFollowerEstimated: true,
                        viewCount: post.like_count * 5, // 非常に単純な推定
                        viewCountConfidence: {
                            lower: post.like_count * 3,
                            upper: post.like_count * 7
                        },
                        isViewCountEstimated: true
                    };
                }
            })
        );
        
        // エンゲージメントフィルターが有効な場合
        let filteredPosts = enrichedPosts;
        if (engagementFilter && engagementFilter.checked) {
            filteredPosts = enrichedPosts.filter(post => 
                (post.like_count / post.followerCount) * 100 >= 3
            );
        }
        
        // 並び替え
        if (sortBy && sortBy.value) {
            switch (sortBy.value) {
                case 'likeCount':
                    filteredPosts.sort((a, b) => b.like_count - a.like_count);
                    break;
                case 'estimatedViews':
                    filteredPosts.sort((a, b) => b.viewCount - a.viewCount);
                    break;
                case 'engagementRate':
                    filteredPosts.sort((a, b) => 
                        (b.like_count / b.followerCount) - (a.like_count / a.followerCount)
                    );
                    break;
                case 'recent':
                default:
                    filteredPosts.sort((a, b) => 
                        new Date(b.timestamp) - new Date(a.timestamp)
                    );
                    break;
            }
        }
        
        allPosts = filteredPosts;
        displayResults(filteredPosts);
        
    } catch (error) {
        console.error("検索エラー:", error);
        results.innerHTML = `<div class="col-span-full text-center text-red-500">エラーが発生しました: ${error.message}</div>`;
    }
}

// 再生回数を推定する関数
function estimateViewCount(likeCount, commentCount, followerCount) {
    // 係数（実際にはより複雑なモデルが必要）
    const coefficients = {
        likeWeight: 5.0,
        commentWeight: 10.0,
        followerRatioWeight: 0.02,
        baseMultiplier: 1.2
    };
    
    // 推定式
    const predictedViews = 
        (likeCount * coefficients.likeWeight) + 
        (commentCount * coefficients.commentWeight) + 
        ((likeCount / followerCount) * followerCount * coefficients.followerRatioWeight) * 
        coefficients.baseMultiplier;
    
    // 信頼区間の計算（±30%の範囲）
    const confidenceInterval = {
        lower: Math.round(predictedViews * 0.7),
        upper: Math.round(predictedViews * 1.3)
    };
    
    return {
        estimated: Math.round(predictedViews),
        confidenceInterval
    };
}

// 検索結果表示
function displayResults(posts) {
    if (!posts || posts.length === 0 || !results) {
        results.innerHTML = '<div class="col-span-full text-center text-gray-500">条件に一致する投稿が見つかりませんでした</div>';
        return;
    }
    
    results.innerHTML = '';
    
    posts.forEach(post => {
        const likeEngagementRate = ((post.like_count / post.followerCount) * 100).toFixed(2);
        const viewEngagementRate = ((post.viewCount / post.followerCount) * 100).toFixed(2);
        
        const postElement = document.createElement('div');
        postElement.className = "bg-white rounded-lg shadow-md overflow-hidden";
        postElement.innerHTML = `
            <div class="relative">
                <a href="${post.permalink}" target="_blank">
                    <img src="${post.thumbnail_url || post.media_url}" alt="${post.caption || 'Instagram post'}" class="w-full aspect-square object-cover">
                    <div class="absolute top-2 right-2 bg-pink-500 text-white text-xs px-2 py-1 rounded-full">
                        リール
                    </div>
                </a>
            </div>
            <div class="p-4">
                <p class="text-gray-500 text-xs mb-2">${formatDate(post.timestamp)}</p>
                <div class="flex justify-between mb-3">
                    <div>
                        <p class="text-gray-600 text-sm font-medium">${post.username}</p>
                        <p class="text-gray-600 text-xs">${formatNumber(post.followerCount)}フォロワー${post.isFollowerEstimated ? '(推定)' : ''}</p>
                    </div>
                    <a href="${post.permalink}" target="_blank" class="text-blue-600 hover:text-blue-800 text-sm">
                        <i class="fas fa-external-link-alt"></i>
                    </a>
                </div>
                
                <div class="grid grid-cols-2 gap-2 mb-3">
                    <div class="text-center p-1 bg-gray-50 rounded">
                        <p class="text-lg font-bold">${formatNumber(post.like_count)}</p>
                        <p class="text-xs text-gray-500">いいね</p>
                    </div>
                    <div class="text-center p-1 bg-gray-50 rounded relative">
                        <p class="text-lg font-bold">${formatNumber(post.viewCount)}</p>
                        <p class="text-xs text-gray-500">再生数${post.isViewCountEstimated ? '(推定)' : ''}</p>
                        ${post.isViewCountEstimated ? `<span class="absolute -top-1 -right-1 text-xs text-white bg-yellow-500 rounded-full w-4 h-4 flex items-center justify-center" title="推定値: ${post.viewCountConfidence.lower}~${post.viewCountConfidence.upper}">?</span>` : ''}
                    </div>
                </div>
                
                <div class="flex justify-between text-xs text-gray-500 mb-2">
                    <span>いいね率: ${likeEngagementRate}%</span>
                    <span>再生率: ${viewEngagementRate}%</span>
                </div>
            </div>
        `;
        
        results.appendChild(postElement);
    });
    
    if (resultsArea) {
        resultsArea.classList.remove('hidden');
    }
}

// スプレッドシートにエクスポート
function exportToSpreadsheet() {
    const sheetId = localStorage.getItem('instagramSheetId');
    const scriptUrl = localStorage.getItem('instagramScriptUrl');
    
    if (!sheetId || !scriptUrl) {
        alert('スプレッドシート設定がありません');
        return;
    }
    
    // エクスポート用のデータを作成
    const exportData = allPosts.map(post => ({
        username: post.username,
        followers: post.followerCount,
        likes: post.like_count,
        comments: post.comments_count || 0,
        estimatedViews: post.viewCount,
        isEstimated: post.isViewCountEstimated ? 'Yes' : 'No',
        confidenceLower: post.viewCountConfidence?.lower || '',
        confidenceUpper: post.viewCountConfidence?.upper || '',
        engagementRateLikes: ((post.like_count / post.followerCount) * 100).toFixed(2),
        engagementRateViews: ((post.viewCount / post.followerCount) * 100).toFixed(2),
        url: post.permalink,
        timestamp: post.timestamp,
        searchQuery: searchQuery.value.trim()
    }));
    
    // エクスポート中の表示
    exportButton.disabled = true;
    exportButton.innerHTML = '<div class="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>送信中...';
    
    // GASにデータを送信
    fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "no-cors",
        body: JSON.stringify({ 
            sheetId: sheetId,
            searchQuery: searchQuery.value.trim(),
            posts: exportData
        })
    })
    .then(response => {
        console.log("データ送信完了");
        alert("データをスプレッドシートに送信しました！");
    })
    .catch(error => {
        console.error("送信エラー:", error);
        alert(`送信に失敗しました: ${error.message}`);
    })
    .finally(() => {
        exportButton.disabled = false;
        exportButton.innerHTML = '<i class="fas fa-file-export mr-2"></i>スプレッドシートに保存';
    });
}

// ユーティリティ関数
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    } else {
        return num.toString();
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP');
}
