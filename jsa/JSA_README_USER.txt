前置条件：jdk17及以上版本

安装：

1. 解压secanalyzer.zip到您的安装目录，如 D:\app\secanalyzer
2. 配置PATH环境变量，在Path中添加环境变量，如 D:\app\secanalyzer\bin

使用：

打开cmd命令行，执行:
========================================================
secanalyzer files/dirs [options]
========================================================
参数解释：
	1. files/dirs 为您所需要分析的文件或目录
	2. 分析器的选项参数格式为  --name=value，选项类型如下：

| 选项参数    	| 默认值                  					| 描述                                                         |
| ------------- | -------------------------------------- | ------------------------------------------------------------ |
| project     	| demo                    				| 本次分析的项目名称，分析结果文件与默认日志文件根据该选项值命名   |
| analyzerLog 	| false                   					| 是否输出分析器健全性检查结果                                 |
| apiDefs     	|                        	 				| 指定自定义 API 定义文件                                      |
| apiModify   	| Warning                 				| 是否允许修改 API 字段，可选值：`Disable,Warning,Allow`       |
| customApi  	| false                  					| 是否加载自定义 API 定义                                      |
| inType      	| [none]                  					| 指定分析的源文件类型，选可选值：`js,java,ir,class`           |
| outPath     	| ./                      					| 结果文件的输出目录                                           |
| irPath      	| $userHmoe/.dsa/dlir     			| 输入 IR 文件的目录                                           |
| ignore      	| [**/node_modules]       			| 需要忽略的文件或目录，输入多个时使用`,`分隔                  |
| outFormat   	| sarif                  					| 结果文件格式。选项有： `sarif,xml`                           |
| stdApi      	| true                    					| 是否加载标准 API 定义                                        |
| runEnv      	| unknown                 				| 指定js程序的运行环境，可选值：`node_commonjs, node_module, web_browser, web_worker` |
| log         	| $userHmoe/.dsa/log/demo.log	| 指定日志输出文件                                             |
| srcroot     	| []                      					| java项目中的源路径，即src目录，存在跨文件访问必填            |
| libpath     	| []                      					| java项目所依赖的 jar 的目录路径，项目或文件依赖第三方jar包时必填 |
| jdkhome     	| []                      					| java项目中使用的 JDK 路径，使用了jdk8及以下版本的扩展程序包必填 |

Tips：翻译器会将源代码翻译为中间代码，存放在  <irPath>/<project>  目录下，每次运行前会删除该目录避免上一次执行干扰分析结果。前端翻译器也可以单独使用，详情见附录。


附录1：

js前端翻译器使用
	1. 将相应版本的可执行文件babel与js2dir置于同一目录下
	2. cmd命令行执行  js2dir filenames... [options] 。filename可以是文件或者目录，options是可选参数

| options					| 描述  |
| ---------------------------------	| -------------------------------------------------- |
| --from=filename			| 需要翻译的文件或目录    |
| --to=output				| 将翻译结果输出到目录output，缺省时输出结果到终端    |
| --log=logfile				| 将错误输出保存到指定文件里，默认为$USER_HOME/.dsa/log/js2dir.log    |
| --sourcemap				| 输出结果带有源代码位置信息    |
| --ignore=regExp1,regExp2	| 忽略regExp通配符中包含的文件    |
| --delete-dir-onstart			| 慎用!! 在翻译前删除`output`文件夹    |
| --help, -h					| 帮助信息    |
| --version, -V				| 版本信息    |

通配符的定义如下：
	* ：匹配任意数量字符，除了路径分隔符/
	** ：匹配任意数量目录或文件
	*.ext ：匹配0个或者多个字母的文件名，文件后缀为`ext`
示例：
| Example 			| Matches						| Does not match		|
| -----------------------	| ------------------------------------------	| -----------------------------	|
| dir1/*      		| dir1/file.js, dir1/file.ts                   	| dir2/file.js			|
| dir1/**/file.js  		| dir1/file.js, dir1/dir2/file.js 		| dir1/otherFileName.js 	|
| dir/*.js        		| dir/file1.js, dir/file2.js                     	| dir/file.otherExtension	|
注意：
1. 该通配符是基于babel的通配符定义，只支持上面列举出的三种简单匹配，并不支持 some.*，some*.js 等
2. 第一个目录不可以为通配符，并且需要是有效的起始路径，如D:/**/dir/**，../project/**/dir/**，不支持**/dir/**，dir/**
3. windows中使用绝对路径注意盘符大小写，应与from中的大小写保持一致

附录2：

java前端翻译器使用

执行java2dir.jar： java -jar java2dir-1.0.jar filenames... [options]
| options						| 描述    |
| ---------------------------------	| ---------------------------------------------------------------- |
| --from=filename			| 需要翻译的文件或目录    |
| --to=output				| 将翻译结果输出到目录output，默认值为./    |
| --log=logPath				| 单独将日志输出到logPath，默认值为 $USER_HOME/.dsa/log/java2dir.log    |
| --sourcemap				| 输出结果带有源代码位置信息    |
| --ignore=regExp1,regExp2	| 忽略regExp通配符中包含的文件    |
| --delete-dir-onstart			| 慎用!! 在翻译前删除`output`文件夹    |
| --srcroot=regExp1,regExp2	| 解析的项目源路径    |
| --libpath=regExp1,regExp2	| 包含一个或多个依赖jar包的文件夹路径，项目或文件依赖第三方jar包时必填    |
| --jdkhome=jdkHome		| 输入的项目所使用的jdk目录，若输入的项目中使用了jdk8及以下版本的扩展程序包，则需要添加这个参数    |
| --tips=true				| 是否输出翻译提示信息，默认为true    |
| --help, -h					| 帮助信息    |
| --version, -V				| 版本信息    |


regExp支持的通配符定义：
	? : 匹配任意1个字符
	* : 匹配0个或多个字符
示例：
| Example 			| Matches							| Does not match		|
| -----------------------	| ------------------------------------------------	| -----------------------------	|
| dir1/*      		| dir1/file.java, dir1/dir2/file.java			| dir2/file.java			|
| dir1/*Service.java  	| dir1/aService.java, dir1/abService.java	| dir1/aController.java 	|
| */file.java        		| dir/file.java, dir1/file.java                 		| dir/otherFileName.java	|

1. 使用通配符加 : 前缀，避免被命令行或者JVM解析，导致输出目录混乱和重复翻译
2. 该通配符使用不限于上面三种模式，只要是遵循通配符定义的表达式均为有效，但在作为srcroot和libpath参数时仍需提供有效的起始目录，并且windows中使用绝对路径注意盘符大小写，应与from中的大小写保持一致

注：以上所有选项参数的值若有空格时，请使用引号将参数值包裹起来。 如：jdkhome="C:\Program Files\Java\jdk1.8"

附录3：

通过脚本运行分析。脚本中会对每一个需分析的文件单独进行分析，分析结果更全面。

直接分析工程：tools/run_secanalyzer/run_secanalyzer.py
对工程进行比较（需配置）：tools/run_secanalyzer/run_check.py

更多信息可以参考 tools/run_secanalyzer/README_USER.md 文档
