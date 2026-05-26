import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { firebaseConfig } from "./firebaseConfig.js";
import { getDatabase, ref, get, onValue} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";



// Firebaseの初期化
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

//html要素の取得
const resetButton = document.getElementById("reset_button");
const yearInput = document.getElementById("year_input");
const monthflag = document.getElementById("month_calendar");//何月を選択してるかを取得するよ
const dayflag = document.getElementById("daily_calendar");//何日を選択しているのかを取得するよ
const latestUsingList = document.getElementById("latest-using");
const timeElement = document.getElementById("time");
const cmElement = document.getElementById("cm");
const yeargraphElement = document.getElementById("year_graph");//indexの方にも入れる
const monthgraphElement = document.getElementById("month_graph");

let yearChart = null;
let monthChart = null;
let max_cm = 6000; //トイペの長さ仮定

// test1 を取得
const test1Ref = ref(db, "test1");//データベースのtest1の場所から全部取って来る


//トイペの残量を求める
onValue(test1Ref, (snapshot) => {
    const data = snapshot.val();
    latestUsingList.innerHTML = ""; //最新の使用のリストを空にする

    const entries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]));
    const latestEntries = entries.slice(-1);
    latestEntries.forEach(([id, value]) => {
        max_cm = max_cm - value;
        document.getElementById("cm").textContent = max_cm;
        if(max_cm <= 500){
            document.getElementById("alert").textContent = "トイレットペーパーが少なくなっています。補充してください。";
        }
    });
})
//リセットボタンが押されたら残量追加
resetButton.addEventListener("click", () => {
    max_cm = 6000;
    document.getElementById("cm").textContent = max_cm;
    document.getElementById("alert").textContent = "";
})




//最新3回分の使用状況のリストを表示するための処理
onValue(test1Ref, (snapshot) => {
    const data = snapshot.val();
    latestUsingList.innerHTML = ""; //最新の使用のリストを空にする

    const entries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]));
    const latestEntries = entries.slice(-3); // 最新の3件を取得
    latestEntries.forEach(([id, value]) => {
        const li = document.createElement("li");
        li.textContent = `${id}に、トイレットペーパーを${Math.trunc(value)}cm使用しました`;
        latestUsingList.appendChild(li);
    });
})






//yearinputに入力された年の月毎の使用量を表示する。月毎に加算して棒グラフで表示
yearInput.addEventListener("keydown", async (e) =>{
    if (e.key !== "Enter") {
        return;
    }
    const selected_year =  yearInput.value; //ここに2026みたいなのが入る
    const monthly_sum = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; //月毎の使用量を保存する配列
    const month = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];//グラフのx軸のラベル
    //yearinputが変わったら、グラフが変わる。
    //月毎の使用量を導出し、グラフ描写
    const snapshot = await get(test1Ref);
    if (snapshot.exists()){
        const data = snapshot.val();
        Object.entries(data).forEach(([id, value]) =>{
            for (let i = 1; i <= 12; i++){
                let searchPrefix;
                if(i<10){
                    
                    searchPrefix = selected_year+"-0"+i.toString();//2026-01, 2026-02みたいな感じで検索する
                    
                }
                else{
                    searchPrefix = selected_year+"-"+i.toString();//2026-10, 2026-11みたいな感じで検索する
                }

                if(id.startsWith(searchPrefix)){
                    monthly_sum[i-1] = monthly_sum[i-1]+value;
                }   
            }
        })
        //グラフ描写ここでする。x軸はmonth, y軸はmonthly_sumの値
        const ctx = yeargraphElement.getContext("2d");
        if (yearChart) {
            yearChart.destroy();
        }
        yearChart = new Chart (ctx, {
            type: "bar",
            data: {
                labels: month,
                datasets: [{
                    label: selected_year+"年の月毎の使用量",
                    data: monthly_sum,
                    backgroundColor: "rgba(75, 192, 192, 0.2)",
                    borderColor: "rgba(75, 192, 192, 1)",
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: "使用量(cm)"
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: "月"
                        }
                    }
                }
            }
        })
    }
})


monthflag.addEventListener("change",async () =>{
    const selectedMonth = monthflag.value; //ここに2026-05みたいなのが入る
    //その月が何日あるのか判定
    const nowyear = selectedMonth.slice(0, 4);
    let nowmonth = selectedMonth.slice(5, 7);//02とか11とかになる。
    if (nowmonth.startsWith("0")){
        nowmonth = nowmonth.slice(1, 2);
    }
    const daysInMonth = new Date(nowyear, nowmonth, 0).getDate();//その月の日数がわかる
    const daily_sum = new Array(daysInMonth).fill(0);//日毎の使用量を保存する配列。
    const days = [];
    for (let i = 1; i <= daysInMonth; i++){
        days.push(i+"日");
    }//これで、days = [1日, 2日, 3日, ..., 31日]みたいな感じに
    const snapshot = await get(test1Ref);
        if (snapshot.exists()){
            const data = snapshot.val();
            Object.entries(data).forEach(([id, value]) =>{
                for (let i = 1; i <= daysInMonth; i++){
                    let searchPrefix;
                    if(i<10){
                        if(nowmonth<10){
                            searchPrefix = nowyear+"-0"+nowmonth+"-0"+i.toString();
                        }
                        else{
                            searchPrefix = nowyear+"-"+nowmonth+"-0"+i.toString();
                        }
                    }
                    else{
                        if (nowmonth<10){
                            searchPrefix = nowyear+"-0"+nowmonth+"-"+i.toString();
                        }
                        else{
                            searchPrefix = nowyear+"-"+nowmonth+"-"+i.toString();
                        }
                    }

                    if(id.startsWith(searchPrefix)){
                        daily_sum[i-1] = daily_sum[i-1]+value;
                    }   
                }
            })
            //グラフ描写ここでする。x軸はmonth, y軸はmonthly_sumの値
            const ctx = monthgraphElement.getContext("2d");
            if (monthChart) {
                monthChart.destroy();
            }
            monthChart = new Chart (ctx, {
                type: "bar",
                data: {
                    labels: days,
                    datasets: [{
                        label: nowmonth+"月の日ごとの使用量",
                        data: daily_sum,
                        backgroundColor: "rgba(75, 192, 192, 0.2)",
                        borderColor: "rgba(75, 192, 192, 1)",
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: "使用量(cm)"
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: "日付"
                            }
                        }
                    }
                }
            })
        }
    })
